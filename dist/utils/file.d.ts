/// <reference types="node" />
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
export declare type MediaTypes = Record<string, string[]>;
export declare function identify(file: Buffer | string, { mediaTypes }?: {
    mediaTypes?: MediaTypes;
}): Promise<FileMetadata>;
//# sourceMappingURL=file.d.ts.map