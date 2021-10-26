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
Object.defineProperty(exports, "__esModule", { value: true });
exports.identify = void 0;
const childProcess = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const execFile = (0, util_1.promisify)(childProcess.execFile);
const MEDIA_TYPES = (() => {
    try {
        const data = fs.readFileSync('/etc/mime.types', 'utf8');
        return Object.fromEntries(data
            .split(/\n+/)
            .filter(s => !s.startsWith('#'))
            .filter(Boolean)
            .map(s => {
            const [type, ...extensions] = s.split(/\s+/);
            return [type, extensions];
        }));
    }
    catch {
        return {};
    }
})();
async function getMediaType(file) {
    const isBuffer = Buffer.isBuffer(file);
    const filePath = isBuffer ? '-' : file;
    const promise = execFile('file', ['-b', '-k', '-n', '-r', '--mime-type', filePath]);
    if (isBuffer) {
        promise.child.stdin.on('error', (e) => {
            if (e.code !== 'EPIPE')
                throw e;
        });
        promise.child.stdin.end(file);
    }
    return (await promise).stdout.trim().split('\n')[0];
}
async function getSize(file) {
    return Buffer.isBuffer(file)
        ? file.length
        : (await fs.promises.readFile(file)).length;
}
async function identify(file, { mediaTypes = {} } = {}) {
    var _a;
    const [mediaType, size] = await Promise.all([
        getMediaType(file),
        getSize(file)
    ]);
    const ext = mediaType
        ? (_a = { ...MEDIA_TYPES, ...mediaTypes }[mediaType]) === null || _a === void 0 ? void 0 : _a[0]
        : undefined;
    return {
        format: ext,
        mediaType,
        size
    };
}
exports.identify = identify;
//# sourceMappingURL=file.js.map