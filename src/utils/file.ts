import ErrnoException = NodeJS.ErrnoException;
import * as childProcess from 'child_process';
import * as fs           from 'fs';
import {promisify}       from 'util';

const execFile = promisify(childProcess.execFile);



export interface FileMetadata {
	/**
	 * Detected file's format.
	 *
	 * Ex.: `jpeg`, `mp3`, `mp4`, `txt`, etc.
	 */
	format: string | undefined;
	/**
	 * Detected file's media type (MIME type).
	 *
	 * Ex.: `image/jpeg`, `audio/mpeg`, `video/mp4`, `text/plain`, etc.
	 */
	mediaType: string | undefined;
	/**
	 * File's size in bytes.
	 */
	size: number;
}

export type MediaTypes = Record<string, string[]>



const MEDIA_TYPES: MediaTypes = ((): MediaTypes => {
	try {
		const data: string = fs.readFileSync('/etc/mime.types', 'utf8')
		return Object.fromEntries(data
			.split(/\n+/)
			.filter(s => !s.startsWith('#'))
			.filter(Boolean)
			.map(s => {
				const [type, ...extensions] = s.split(/\s+/) as [string, ...string[]];
				return [type, extensions];
			}));
	} catch {
		return {};
	}
})();

async function getMediaType(file: Buffer | string): Promise<string | undefined> {
	const isBuffer = Buffer.isBuffer(file);
	const filePath = isBuffer ? '-' : file;
	
	const promise = execFile('file', ['-b', '-k', '-n', '-r', '--mime-type', filePath]);
	if (isBuffer) {
		promise.child.stdin!.on('error', (e: ErrnoException) => {
			if (e.code !== 'EPIPE') throw e;
		});
		promise.child.stdin!.end(file);
	}
	
	return (await promise).stdout.trim().split('\n')[0];
}

async function getSize(file: Buffer | string): Promise<number> {
	return Buffer.isBuffer(file)
		? file.length
		: (await fs.promises.readFile(file)).length;
}

export async function identify(
	file:              Buffer | string,
	{mediaTypes = {}}: {mediaTypes?: MediaTypes} = {}
): Promise<FileMetadata> {
	const [mediaType, size] = await Promise.all([
		getMediaType(file),
		getSize(     file)
	]);
	
	const ext: string | undefined = mediaType
		? {...MEDIA_TYPES, ...mediaTypes}[mediaType]?.[0]
		: undefined;
	
	return {
		format: ext,
		mediaType,
		size
	};
}
