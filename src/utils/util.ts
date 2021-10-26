import fs from 'fs/promises';

export async function checkPath(path: string): Promise<string | null> {
	try {
		await fs.access(path);
		return path;
	} catch {
		return null;
	}
}
