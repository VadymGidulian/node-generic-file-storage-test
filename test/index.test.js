'use strict';

const fs   = require('fs');
const path = require('path');
const exp = require('constants');

const GenericFileStorage = require('../dist').default;

const PATH = 'files';

const FILES_DATA = [
	['test.txt', 'txt', 'text/plain']
];
const GENERATOR = (id, srcPath, destPath, {name, length}) => {
	let data = fs.readFileSync(srcPath, 'utf8');
	data = data.slice(0, length);
	fs.writeFileSync(destPath, data, 'utf8');
};
const GENERATOR_ASYNC = async (id, srcPath, destPath, {name, length}) => {
	let data = await fs.promises.readFile(srcPath, 'utf8');
	data = data.slice(0, length);
	await fs.promises.writeFile(destPath, data, 'utf8');
};

test('Absent path', () => {
	expect(() => new GenericFileStorage()).toThrow('Path is required');
});

describe.each(FILES_DATA)('`%s`', (fileName, format, mediaType) => {
	const CONFIG = {
		path: PATH,
		mediaTypes: {
			'text/plain': ['txt']
		}
	};
	const FILE = fs.readFileSync(`test/assets/${fileName}`);
	
	beforeEach(clean);
	afterAll(  clean);
	
	describe('Create', () => {
		test('Create a file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const {id, metadata} = await storage.saveFile(FILE);
			expect(id).toBeTruthy();
			expect(metadata).toStrictEqual({
				format,
				mediaType,
				size: FILE.length
			});
		});
		
		test('Create a file with changed metadata', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const {id, metadata} = await storage.saveFile(FILE, {
				beforeSave({metadata}) {
					metadata.length = metadata.size;
				}
			});
			expect(id).toBeTruthy();
			expect(metadata).toStrictEqual({
				format,
				mediaType,
				size:   FILE.length,
				length: FILE.length
			});
		});
	});
	
	describe('Get', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			({id: GLOBALS.fileId} = await storage.saveFile(FILE));
		});
		
		test('Get an existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const filePath = await storage.getFilePath(GLOBALS.fileId);
			expect(filePath).toBeTruthy();
			
			const file = fs.readFileSync(filePath);
			expect(file).toStrictEqual(FILE);
		});
		
		test('Get path of a non-existing file variant', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			expect(await storage.getFilePath(GLOBALS.fileId, '404')).toBeNull();
			
			{
				const filePath = await storage.getFilePath(GLOBALS.fileId);
				expect(filePath).toBeTruthy();
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: true})).toBe(filePath);
			}
		});
		
		test('Get metadata of an existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			expect(await storage.getFileMetadata(GLOBALS.fileId)).toStrictEqual({
				format,
				mediaType,
				size: FILE.length
			});
		});
		
		test('Get path of a non-existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			expect(await storage.getFilePath('404')).toBeNull();
		});
		
		test('Get metadata of a non-existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			expect(await storage.getFileMetadata('404')).toBeNull();
		});
	});
	
	describe('Delete', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			({id: GLOBALS.fileId} = await storage.saveFile(FILE));
		});
		
		test('Delete an existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const {dir, name} = path.parse(await storage.getFilePath(GLOBALS.fileId));
			
			await storage.deleteFile(GLOBALS.fileId);
			
			const filePath = await storage.getFilePath(GLOBALS.fileId);
			expect(filePath).toBeNull();
			
			expect(fs.readdirSync(dir).some(fileName => fileName.startsWith(name))).toBeFalsy();
		});
		
		test('Delete a non-existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			await storage.deleteFile('404');
			
			const filePath = await storage.getFilePath('404');
			expect(filePath).toBeNull();
		});
	});
});

describe.each(FILES_DATA)('`%s` with variants', (fileName, format, mediaType) => {
	const CONFIG = {
		path: PATH,
		variants: [
			{name: 'tiny',    length:  10},
			{name: 'preview', length: 100}
		],
		mediaTypes: {
			'text/plain': ['txt']
		}
	};
	const FILE = fs.readFileSync(`test/assets/${fileName}`);
	
	beforeEach(clean);
	afterAll(  clean);
	
	describe('Create', () => { // TODO beforeSave
		test('Create a file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const {id, metadata} = await storage.saveFile(FILE);
			expect(id).toBeTruthy();
			expect(metadata).toStrictEqual({
				format,
				mediaType,
				size: FILE.length
			});
			
			await storage.generateFileVariants(id, GENERATOR);
		});
		
		test('Create a file (async generator)', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const {id, metadata} = await storage.saveFile(FILE);
			expect(id).toBeTruthy();
			expect(metadata).toStrictEqual({
				format,
				mediaType,
				size: FILE.length
			});
			
			await storage.generateFileVariants(id, GENERATOR_ASYNC);
		});
	});
	
	describe('Get', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			({id: GLOBALS.fileId} = await storage.saveFile(FILE));
			await storage.generateFileVariants(GLOBALS.fileId, GENERATOR);
		});
		
		test('Get an existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const filePath = await storage.getFilePath(GLOBALS.fileId);
			expect(filePath).toBeTruthy();
			
			const file = fs.readFileSync(filePath);
			expect(file).toStrictEqual(FILE);
		});
		
		test('Get an existing file variant', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const filePath = await storage.getFilePath(GLOBALS.fileId);
			
			const variantPath = await storage.getFilePath(GLOBALS.fileId, CONFIG.variants[0].name);
			expect(variantPath).toBeTruthy();
			expect(variantPath).not.toBe(filePath);
			
			expect(await storage.getFilePath(GLOBALS.fileId, CONFIG.variants[0].name, {fallback: true})).toBe(variantPath);
		});
		
		test('Get metadata of an existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			expect(await storage.getFileMetadata(GLOBALS.fileId)).toStrictEqual({
				format,
				mediaType,
				size: FILE.length
			});
		});
		
		test('Get a non-existing file variant', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			{
				expect(await storage.getFilePath(GLOBALS.fileId, '404')).toBeNull();
			}
			
			{
				const filePath = await storage.getFilePath(GLOBALS.fileId);
				expect(filePath).toBeTruthy();
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: true})).toBe(filePath);
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: [true]})).toBe(filePath);
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: ['not-found', true]})).toBe(filePath);
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: ['not-found', true, CONFIG.variants[0].name]})).toBe(filePath);
			}
			
			{
				const fallbackVariantPath = await storage.getFilePath(GLOBALS.fileId, CONFIG.variants[0].name);
				expect(fallbackVariantPath).toBeTruthy();
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: CONFIG.variants[0].name})).toBe(fallbackVariantPath);
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: [CONFIG.variants[0].name]})).toBe(fallbackVariantPath);
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: ['not-found', CONFIG.variants[0].name]})).toBe(fallbackVariantPath);
				
				expect(await storage.getFilePath(GLOBALS.fileId, '404', {fallback: ['not-found', CONFIG.variants[0].name, true]})).toBe(fallbackVariantPath);
			}
		});
	});
	
	describe('Dynamic variants', () => {
		const CONFIG = {
			path: PATH,
			variants: (metadata) => {
				expect(metadata).toStrictEqual({
					format,
					mediaType,
					size: FILE.length
				});
				
				return [
					{name: 'xl', length: 1024},
					{name: 'l',  length:  256},
					{name: 's',  length:  128},
					{name: 'xs', length:   64}
				].filter(({length}) => metadata.size > length);
			},
			mediaTypes: {
				'text/plain': ['txt']
			}
		};

		test('Create a file', async () => {
			const storage = new GenericFileStorage(CONFIG);

			const {id, metadata} = await storage.saveFile(FILE);
			expect(id).toBeTruthy();
			expect(metadata).toStrictEqual({
				format,
				mediaType,
				size: FILE.length
			});
			await storage.generateFileVariants(id, GENERATOR);

			expect(await storage.getFilePath(id)).toBeTruthy();
			
			expect(await storage.getFilePath(id, 'xl')).toBeNull();
			expect(await storage.getFilePath(id, 'l')) .toBeTruthy();
			expect(await storage.getFilePath(id, 's')) .toBeTruthy();
			expect(await storage.getFilePath(id, 'xs')).toBeTruthy();
		});
	});
	
	describe('Regenerate', () => {
		const OLD_CONFIG = {
			path: PATH,
			variants: [
				{name: 'old', length: 256}
			]
		};
		const NEW_CONFIG = {
			path: PATH,
			variants: [
				{name: 'new', length: 256}
			]
		};
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new GenericFileStorage(OLD_CONFIG);
			
			({id: GLOBALS.fileId} = await storage.saveFile(FILE));
			await storage.generateFileVariants(GLOBALS.fileId, GENERATOR);
		});
		
		test('Regenerate', async () => {
			const storage = new GenericFileStorage(NEW_CONFIG);
			
			const oldMetadata = await storage.getFileMetadata(GLOBALS.fileId);
			expect(oldMetadata).toBeTruthy();
			
			const oldVariantPath = await storage.getFilePath(GLOBALS.fileId, OLD_CONFIG.variants[0].name);
			expect(oldVariantPath).toBeTruthy();
			
			await storage.generateFileVariants(GLOBALS.fileId, GENERATOR);
			
			expect(await storage.getFileMetadata(GLOBALS.fileId)).toStrictEqual(oldMetadata);
			
			expect(await storage.getFilePath(GLOBALS.fileId, OLD_CONFIG.variants[0].name)).toBe(oldVariantPath);
			
			const newVariantPath = await storage.getFilePath(GLOBALS.fileId, NEW_CONFIG.variants[0].name);
			expect(newVariantPath).toBeTruthy();
			expect(newVariantPath).not.toBe(oldVariantPath);
		});
		
		test('Clean and regenerate', async () => {
			const storage = new GenericFileStorage(NEW_CONFIG);
			
			const oldMetadata = await storage.getFileMetadata(GLOBALS.fileId);
			expect(oldMetadata).toBeTruthy();
			
			const oldVariantPath = await storage.getFilePath(GLOBALS.fileId, OLD_CONFIG.variants[0].name);
			expect(oldVariantPath).toBeTruthy();
			
			await storage.generateFileVariants(GLOBALS.fileId, GENERATOR, {clean: true});
			
			expect(await storage.getFileMetadata(GLOBALS.fileId)).toStrictEqual(oldMetadata);
			
			expect(await storage.getFilePath(GLOBALS.fileId, OLD_CONFIG.variants[0].name)).toBeNull();
			
			const newVariantPath = await storage.getFilePath(GLOBALS.fileId, NEW_CONFIG.variants[0].name);
			expect(newVariantPath).toBeTruthy();
			expect(newVariantPath).not.toBe(oldVariantPath);
		});
	});
	
	describe('Delete', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			({id: GLOBALS.fileId} = await storage.saveFile(FILE));
			await storage.generateFileVariants(GLOBALS.fileId, GENERATOR);
		});
		
		test('Delete an existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			const {dir, name} = path.parse(await storage.getFilePath(GLOBALS.fileId));
			
			await storage.deleteFile(GLOBALS.fileId);
			
			{
				const filePath = await storage.getFilePath(GLOBALS.fileId);
				expect(filePath).toBeNull();
			}
			{
				const variantPath = await storage.getFilePath(GLOBALS.fileId, CONFIG.variants[0].name);
				expect(variantPath).toBeNull();
			}
			
			expect(fs.readdirSync(dir).some(fileName => fileName.startsWith(name))).toBeFalsy();
		});
		
		test('Delete a non-existing file', async () => {
			const storage = new GenericFileStorage(CONFIG);
			
			await storage.deleteFile('404');
			
			const filePath = await storage.getFilePath('404');
			expect(filePath).toBeNull();
		});
	});
});

describe('Regenerate all', () => {
	const OLD_CONFIG = {
		path: PATH,
		variants: [
			{name: 'old', size: 256}
		]
	};
	const NEW_CONFIG = {
		path: PATH,
		variants: [
			{name: 'new', size: 256}
		]
	};
	
	beforeEach(clean);
	afterAll(  clean);
	
	const GLOBALS = {
		fileIds: []
	};
	
	beforeEach(async () => {
		const storage = new GenericFileStorage(OLD_CONFIG);
		
		GLOBALS.fileIds.length = 0;
		for (const [name] of FILES_DATA) {
			const file = fs.readFileSync(`test/assets/${name}`);
			const {id} = await storage.saveFile(file);
			GLOBALS.fileIds.push(id);
			await storage.generateFileVariants(id, GENERATOR);
		}
	});
	
	test('Regenerate all', async () => {
		const storage = new GenericFileStorage(NEW_CONFIG);
		
		const oldMetadatas    = [];
		const oldVariantPaths = [];
		
		for (const fileId of GLOBALS.fileIds) {
			const oldMetadata = await storage.getFileMetadata(fileId);
			expect(oldMetadata).toBeTruthy();
			oldMetadatas.push(oldMetadata);
			
			const oldVariantPath = await storage.getFilePath(fileId, OLD_CONFIG.variants[0].name);
			expect(oldVariantPath).toBeTruthy();
			oldVariantPaths.push(oldVariantPath);
		}
		
		await storage.generateAllFilesVariants(GENERATOR);
		
		for (let i = 0; i < GLOBALS.fileIds.length; i++) {
			const fileId = GLOBALS.fileIds[i];
			
			expect(await storage.getFileMetadata(fileId)).toStrictEqual(oldMetadatas[i]);
			
			const oldVariantPath = await storage.getFilePath(fileId, OLD_CONFIG.variants[0].name);
			expect(oldVariantPath).toBe(oldVariantPaths[i]);
			
			const newVariantPath = await storage.getFilePath(fileId, NEW_CONFIG.variants[0].name);
			expect(newVariantPath).toBeTruthy();
			expect(newVariantPath).not.toBe(oldVariantPath);
		}
	});
	
	test('Clean and regenerate all', async () => {
		const storage = new GenericFileStorage(NEW_CONFIG);
		
		const oldMetadatas    = [];
		const oldVariantPaths = [];
		
		for (const fileId of GLOBALS.fileIds) {
			const oldMetadata = await storage.getFileMetadata(fileId);
			expect(oldMetadata).toBeTruthy();
			oldMetadatas.push(oldMetadata);
			
			const oldVariantPath = await storage.getFilePath(fileId, OLD_CONFIG.variants[0].name);
			expect(oldVariantPath).toBeTruthy();
			oldVariantPaths.push(oldVariantPath);
		}
		
		await storage.generateAllFilesVariants(GENERATOR, {clean: true});
		
		for (let i = 0; i < GLOBALS.fileIds.length; i++) {
			const fileId = GLOBALS.fileIds[i];
			
			expect(await storage.getFileMetadata(fileId)).toStrictEqual(oldMetadatas[i]);
			
			expect(await storage.getFilePath(fileId, OLD_CONFIG.variants[0].name)).toBeNull();
			
			const newVariantPath = await storage.getFilePath(fileId, NEW_CONFIG.variants[0].name);
			expect(newVariantPath).toBeTruthy();
			expect(newVariantPath).not.toBe(oldVariantPaths[i]);
		}
	});
});



function clean() {
	fs.rmSync(PATH, {force: true, recursive: true});
}
