import * as fs        from 'fs/promises';
import * as path      from 'path';
import {TypedEmitter} from 'tiny-typed-emitter';
import {v4 as uuidv4} from 'uuid';
import * as fileUtils from './utils/file';
import {checkPath}    from './utils/util';



export const enum EVENT {
	GENERATE_PROGRESS     = 'generateProgress',
	GENERATE_ALL_PROGRESS = 'generateAllProgress'
}

export interface GenerateProgressEvent {
	/**
	 * File's id.
	 */
	id: string;
	/**
	 * Array of successfully generated variant names.
	 */
	ready: string[];
	/**
	 * Total number of variants to generate.
	 */
	total: number;
}

export interface GenerateAllProgressEvent {
	/**
	 * Last successfully processed file id.
	 */
	id?: string;
	/**
	 * Number of successfully processed files.
	 */
	ready: number;
	/**
	 * Total number of variants to generate.
	 */
	total: number;
}

interface GenericFileStorageEvents {
	[EVENT.GENERATE_PROGRESS]:     (ev: GenerateProgressEvent)    => void;
	[EVENT.GENERATE_ALL_PROGRESS]: (ev: GenerateAllProgressEvent) => void;
}


export type Generator<V> = (
	id:                 string,
	srcPath:            string,
	destPath:           string,
	variantDescription: V
) => Promise<void>;


export interface VariantDescription {
	/**
	 * Variant name.
	 */
	name: string;
}

type Variants<M, V> = V[] | ((metadata: M) => V[]);



/**
 * Storage interface object
 */
export default class GenericFileStorage<
		M extends fileUtils.FileMetadata = fileUtils.FileMetadata,
		V extends VariantDescription     = VariantDescription
	> extends TypedEmitter<GenericFileStorageEvents> {
	
	readonly #path:       string;
	readonly #variants:   Variants<M, V>;
	readonly #mediaTypes: fileUtils.MediaTypes;
	
	#isRegeneratingAll: boolean = false;
	
	constructor({path, variants = [], mediaTypes = {}}: {
		/**
		 * Storage's root path.
		 */
		path: string,
		/**
		 * File variants.
		 */
		variants?: Variants<M, V>,
		/**
		 * Custom media types used for file format detection.
		 */
		mediaTypes?: fileUtils.MediaTypes
	} = {path: ''}) {
		super();
		
		if (!path) throw new Error('Path is required');
		
		this.#path       = path;
		this.#variants   = variants;
		this.#mediaTypes = mediaTypes;
	}
	
	/**
	 * Saves a file to the storage and creates variants, if necessary.
	 * @param buffer - File's buffer.
	 * @return File's id and detected metadata.
	 */
	async saveFile(
		buffer: Buffer,
		{beforeSave, uuid = uuidv4()}: {
			/**
			 * Called before the file will be saved.
			 * @param metadata - File's detected metadata. Metadata may be changed.
			 */
			beforeSave?: ({metadata}: {metadata: fileUtils.FileMetadata}) => void | Promise<void>,
			/**
			 * File's id without extension.
			 */
			uuid?: string
		} = {}
	): Promise<{id: string, metadata: M}> {
		const metadata: fileUtils.FileMetadata = await fileUtils.identify(buffer, {mediaTypes: this.#mediaTypes});
		
		const fileName:         string = `${uuid}.${metadata.format}`;
		const filePath:         string = getFilePath(        this.#path, fileName);
		const metadataFilePath: string = getFileMetadataPath(this.#path, fileName);
		const {dir: fileDir}           = path.parse(filePath);
		
		await beforeSave?.({metadata});
		await fs.mkdir(fileDir, {recursive: true});
		try {
			await Promise.all([
				fs.writeFile(filePath,         buffer),
				fs.writeFile(metadataFilePath, JSON.stringify(metadata), 'utf8')
			]);
			
			return {
				id:       fileName,
				metadata: metadata as M
			};
		} catch (e) {
			await Promise.all([filePath, metadataFilePath]
				.map(path => fs.rm(path, {force: true})));
			
			throw e;
		}
	}
	
	/**
	 * Deletes the file and its variants.
	 * @param id - File's id
	 */
	async deleteFile(id: string): Promise<void> {
		const [name, ext]     = parseId(id);
		const dirPath: string = path.dirname(getFilePath(this.#path, id));
		if (!await checkPath(dirPath)) return;
		
		const fileNames: string[] = (await fs.readdir(dirPath))
			.filter(fileName => fileName.startsWith(name) && (fileName.endsWith(ext) || fileName.endsWith(`${ext}.json`)))
			.map(fileName => path.join(dirPath, fileName));
		
		await Promise.all(fileNames.map(path => fs.rm(path, {force: true})));
	}
	
	/**
	 * Gets file's metadata.
	 * @param id - File's id.
	 * @return File's metadata or `null` if the file does not exist.
	 */
	async getFileMetadata(id: string): Promise<M | null> {
		const filePath: string | null = await checkPath(getFileMetadataPath(this.#path, id));
		if (!filePath) return null;
		
		return JSON.parse(await fs.readFile(filePath, 'utf8'));
	}
	
	/**
	 * Gets file's path.
	 * @param id       - File's id.
	 * @param variant  - Variant name.
	 * @param fallback - Alternative(s) to look for, if the specified variant does not exist. `true` - for original file.
	 * @return File's path or `null` if the File does not exist.
	 */
	async getFilePath(
		id:       string,
		variant?: string,
		{fallback = []}: {
			fallback?: true | string | Array<true | string>
		} = {}
	): Promise<string | null> {
		const variantNames: Array<string | undefined> = [
			variant,
			...(!Array.isArray(fallback) ? [fallback] : fallback)
				.map(f => (f === true) ? undefined : f)
		];
		
		for (const variantName of variantNames) {
			const filePath: string | null = await checkPath(getFilePath(this.#path, id, variantName));
			if (filePath) return filePath;
		}
		
		return null;
	}
	
	/**
	 * (Re)generates file's variants.
	 * @param id        - File's id.
	 * @param generator - A function to create file's variant.
	 * @param clean     - Remove existing variants before?
	 */
	async generateFileVariants(
		id:              string,
		generator:       Generator<V>,
		{clean = false}: {clean?: boolean} = {}
	): Promise<void> {
		const srcPath: string | null = await this.getFilePath(id);
		if (!srcPath) return;
		
		if (clean) {
			const [name, ext]     = parseId(id);
			const dirPath: string = path.dirname(srcPath);
			
			const fileNames: string[] = (await fs.readdir(dirPath))
				.filter(fileName => fileName.startsWith(name) && (fileName !== id) && fileName.endsWith(ext))
				.map(fileName => path.join(dirPath, fileName));
			
			await Promise.all(fileNames.map(path => fs.rm(path, {force: true})));
		}
		
		const generatedVariants: string[]             = [];
		const variants:          VariantDescription[] = Array.isArray(this.#variants)
			? this.#variants
			: this.#variants((await this.getFileMetadata(id))!);
		this.emit(EVENT.GENERATE_PROGRESS, {
			id,
			ready: generatedVariants,
			total: variants.length
		});
		for (const variantDescription of variants) {
			const destPath: string = getFilePath(this.#path, id, variantDescription.name);
			
			await generator(id, srcPath, destPath, variantDescription as V);
			
			generatedVariants.push(variantDescription.name);
			this.emit(EVENT.GENERATE_PROGRESS, {
				id,
				ready: generatedVariants,
				total: variants.length
			});
		}
	}
	
	/**
	 * (Re)generates variants for all files.
	 * @param generator - A function to create file's variant.
	 * @param clean     - Remove existing variants before?
	 */
	async generateAllFilesVariants(
		generator:       Generator<V>,
		{clean = false}: {clean?: boolean} = {}
	): Promise<void> {
		if (this.#isRegeneratingAll) return;
		
		this.#isRegeneratingAll = true;
		try {
			const ids: string[] = [];
			
			for (const hash1 of await fs.readdir(this.#path)) {
				const hash1DirPath: string = path.join(this.#path, hash1);
				
				for (const hash2 of await fs.readdir(hash1DirPath)) {
					const hash2DirPath: string = path.join(hash1DirPath, hash2);
					
					const fileNames: string[] = (await fs.readdir(hash2DirPath))
						.filter(fileName => /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\.\w+$/.test(fileName) && !fileName.endsWith('.json'));
					ids.push(...fileNames);
				}
			}
			
			let processed: number = 0;
			this.emit(EVENT.GENERATE_ALL_PROGRESS, {
				ready: processed,
				total: ids.length
			});
			for (const id of ids) {
				await this.generateFileVariants(id, generator, {clean});
				
				processed++;
				this.emit(EVENT.GENERATE_ALL_PROGRESS, {
					id,
					ready: processed,
					total: ids.length
				});
			}
		} finally {
			this.#isRegeneratingAll = false;
		}
	}
	
};



function getHash(id: string): string[] {
	const [name] = parseId(id);
	
	return [
		name.slice(-3, -2),
		name.slice(-2)
	];
}

function getFileMetadataPath(root: string, id: string): string {
	const hash:     string[] = getHash(id);
	const fileName: string   = `${id}.json`;
	
	return path.join(root, ...hash, fileName);
}

function getFilePath(root: string, id: string, variant?: string): string {
	const [name, ext]        = parseId(id);
	const hash:     string[] = getHash(id);
	const fileName: string   = [name, variant, ext].filter(Boolean).join('.');
	
	return path.join(root, ...hash, fileName);
}

function parseId(id: string): [string, string] {
	return id.split('.') as [string, string];
}
