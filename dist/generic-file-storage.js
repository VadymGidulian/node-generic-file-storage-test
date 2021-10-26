"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _GenericFileStorage_path, _GenericFileStorage_variants, _GenericFileStorage_mediaTypes;
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const uuid_1 = require("uuid");
const fileUtils = __importStar(require("./utils/file"));
const util_1 = require("./utils/util");
/**
 * Storage interface object
 */
class GenericFileStorage extends tiny_typed_emitter_1.TypedEmitter {
    constructor({ path, variants = [], mediaTypes = {} } = { path: '' }) {
        super();
        _GenericFileStorage_path.set(this, void 0);
        _GenericFileStorage_variants.set(this, void 0);
        _GenericFileStorage_mediaTypes.set(this, void 0);
        if (!path)
            throw new Error('Path is required');
        __classPrivateFieldSet(this, _GenericFileStorage_path, path, "f");
        __classPrivateFieldSet(this, _GenericFileStorage_variants, variants, "f");
        __classPrivateFieldSet(this, _GenericFileStorage_mediaTypes, mediaTypes, "f");
    }
    /**
     * Saves a file to the storage and creates variants, if necessary.
     * @param buffer - File's buffer.
     * @return File's id and detected metadata.
     */
    async saveFile(buffer, { beforeSave, uuid = (0, uuid_1.v4)() } = {}) {
        const metadata = await fileUtils.identify(buffer, { mediaTypes: __classPrivateFieldGet(this, _GenericFileStorage_mediaTypes, "f") });
        const fileName = `${uuid}.${metadata.format}`;
        const filePath = getFilePath(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"), fileName);
        const metadataFilePath = getFileMetadataPath(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"), fileName);
        const { dir: fileDir } = path.parse(filePath);
        await (beforeSave === null || beforeSave === void 0 ? void 0 : beforeSave({ metadata }));
        await fs.mkdir(fileDir, { recursive: true });
        try {
            await Promise.all([
                fs.writeFile(filePath, buffer),
                fs.writeFile(metadataFilePath, JSON.stringify(metadata), 'utf8')
            ]);
            return { id: fileName, metadata };
        }
        catch (e) {
            await Promise.all([filePath, metadataFilePath]
                .map(path => fs.rm(path, { force: true })));
            throw e;
        }
    }
    /**
     * Deletes the file and its variants.
     * @param id - File's id
     */
    async deleteFile(id) {
        const [name, ext] = parseId(id);
        const dirPath = path.dirname(getFilePath(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"), id));
        if (!await (0, util_1.checkPath)(dirPath))
            return;
        const fileNames = (await fs.readdir(dirPath))
            .filter(fileName => fileName.startsWith(name) && (fileName.endsWith(ext) || fileName.endsWith(`${ext}.json`)))
            .map(fileName => path.join(dirPath, fileName));
        await Promise.all(fileNames.map(path => fs.rm(path, { force: true })));
    }
    /**
     * Gets file's metadata.
     * @param id - File's id.
     * @return File's metadata or `null` if the file does not exist.
     */
    async getFileMetadata(id) {
        const filePath = await (0, util_1.checkPath)(getFileMetadataPath(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"), id));
        if (!filePath)
            return null;
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    }
    /**
     * Gets file's path.
     * @param id       - File's id.
     * @param variant  - Variant name.
     * @param fallback - Alternative(s) to look for, if the specified variant does not exist. `true` - for original file.
     * @return File's path or `null` if the File does not exist.
     */
    async getFilePath(id, variant, { fallback = [] } = {}) {
        const variantNames = [
            variant,
            ...(!Array.isArray(fallback) ? [fallback] : fallback)
                .map(f => (f === true) ? undefined : f)
        ];
        for (const variantName of variantNames) {
            const filePath = await (0, util_1.checkPath)(getFilePath(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"), id, variantName));
            if (filePath)
                return filePath;
        }
        return null;
    }
    /**
     * (Re)generates file's variants.
     * @param id        - File's id.
     * @param generator - A function to create file's variant.
     * @param clean     - Remove existing variants before?
     */
    async generateFileVariants(id, generator, { clean = false } = {}) {
        const srcPath = await this.getFilePath(id);
        if (!srcPath)
            return;
        if (clean) {
            const [name, ext] = parseId(id);
            const dirPath = path.dirname(srcPath);
            const fileNames = (await fs.readdir(dirPath))
                .filter(fileName => fileName.startsWith(name) && (fileName !== id) && fileName.endsWith(ext))
                .map(fileName => path.join(dirPath, fileName));
            await Promise.all(fileNames.map(path => fs.rm(path, { force: true })));
        }
        const generatedVariants = [];
        const variants = Array.isArray(__classPrivateFieldGet(this, _GenericFileStorage_variants, "f"))
            ? __classPrivateFieldGet(this, _GenericFileStorage_variants, "f")
            : __classPrivateFieldGet(this, _GenericFileStorage_variants, "f").call(this, (await this.getFileMetadata(id)));
        for (const variantDescription of variants) {
            const destPath = getFilePath(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"), id, variantDescription.name);
            await generator(id, srcPath, destPath, variantDescription);
            generatedVariants.push(variantDescription.name);
            this.emit("generateProgress" /* GENERATE_PROGRESS */, {
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
    async generateAllFilesVariants(generator, { clean = false } = {}) {
        const ids = [];
        for (const hash1 of await fs.readdir(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"))) {
            const hash1DirPath = path.join(__classPrivateFieldGet(this, _GenericFileStorage_path, "f"), hash1);
            for (const hash2 of await fs.readdir(hash1DirPath)) {
                const hash2DirPath = path.join(hash1DirPath, hash2);
                const fileNames = (await fs.readdir(hash2DirPath))
                    .filter(fileName => /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\.\w+$/.test(fileName) && !fileName.endsWith('.json'));
                ids.push(...fileNames);
            }
        }
        let processed = 0;
        for (const id of ids) {
            await this.generateFileVariants(id, generator, { clean });
            processed++;
            this.emit("generateAllProgress" /* GENERATE_ALL_PROGRESS */, {
                id,
                ready: processed,
                total: ids.length
            });
        }
    }
}
exports.default = GenericFileStorage;
_GenericFileStorage_path = new WeakMap(), _GenericFileStorage_variants = new WeakMap(), _GenericFileStorage_mediaTypes = new WeakMap();
;
function getHash(id) {
    const [name] = parseId(id);
    return [
        name.slice(-3, -2),
        name.slice(-2)
    ];
}
function getFileMetadataPath(root, id) {
    const hash = getHash(id);
    const fileName = `${id}.json`;
    return path.join(root, ...hash, fileName);
}
function getFilePath(root, id, variant) {
    const [name, ext] = parseId(id);
    const hash = getHash(id);
    const fileName = [name, variant, ext].filter(Boolean).join('.');
    return path.join(root, ...hash, fileName);
}
function parseId(id) {
    return id.split('.');
}
//# sourceMappingURL=generic-file-storage.js.map