/// <reference types="node" />
import { TypedEmitter } from 'tiny-typed-emitter';
import * as fileUtils from './utils/file';
export declare const enum EVENT {
    GENERATE_PROGRESS = "generateProgress",
    GENERATE_ALL_PROGRESS = "generateAllProgress"
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
    [EVENT.GENERATE_PROGRESS]: (ev: GenerateProgressEvent) => void;
    [EVENT.GENERATE_ALL_PROGRESS]: (ev: GenerateAllProgressEvent) => void;
}
export declare type Generator<V> = (id: string, srcPath: string, destPath: string, variantDescription: V) => Promise<void>;
export interface VariantDescription {
    /**
     * Variant name.
     */
    name: string;
}
declare type Variants<M, V> = V[] | ((metadata: M) => V[]);
/**
 * Storage interface object
 */
export default class GenericFileStorage<M extends fileUtils.FileMetadata = fileUtils.FileMetadata, V extends VariantDescription = VariantDescription> extends TypedEmitter<GenericFileStorageEvents> {
    #private;
    constructor({ path, variants, mediaTypes }?: {
        /**
         * Storage's root path.
         */
        path: string;
        /**
         * File variants.
         */
        variants?: Variants<M, V>;
        /**
         * Custom media types used for file format detection.
         */
        mediaTypes?: fileUtils.MediaTypes;
    });
    /**
     * Saves a file to the storage and creates variants, if necessary.
     * @param buffer - File's buffer.
     * @return File's id and detected metadata.
     */
    saveFile(buffer: Buffer, { beforeSave, uuid }?: {
        /**
         * Called before the file will be saved.
         * @param metadata - File's detected metadata. Metadata may be changed.
         */
        beforeSave?: ({ metadata }: {
            metadata: fileUtils.FileMetadata;
        }) => void | Promise<void>;
        /**
         * File's id without extension.
         */
        uuid?: string;
    }): Promise<{
        id: string;
        metadata: M;
    }>;
    /**
     * Deletes the file and its variants.
     * @param id - File's id
     */
    deleteFile(id: string): Promise<void>;
    /**
     * Gets file's metadata.
     * @param id - File's id.
     * @return File's metadata or `null` if the file does not exist.
     */
    getFileMetadata(id: string): Promise<M | null>;
    /**
     * Gets file's path.
     * @param id       - File's id.
     * @param variant  - Variant name.
     * @param fallback - Alternative(s) to look for, if the specified variant does not exist. `true` - for original file.
     * @return File's path or `null` if the File does not exist.
     */
    getFilePath(id: string, variant?: string, { fallback }?: {
        fallback?: true | string | Array<true | string>;
    }): Promise<string | null>;
    /**
     * (Re)generates file's variants.
     * @param id        - File's id.
     * @param generator - A function to create file's variant.
     * @param clean     - Remove existing variants before?
     */
    generateFileVariants(id: string, generator: Generator<V>, { clean }?: {
        clean?: boolean;
    }): Promise<void>;
    /**
     * (Re)generates variants for all files.
     * @param generator - A function to create file's variant.
     * @param clean     - Remove existing variants before?
     */
    generateAllFilesVariants(generator: Generator<V>, { clean }?: {
        clean?: boolean;
    }): Promise<void>;
}
export {};
//# sourceMappingURL=generic-file-storage.d.ts.map