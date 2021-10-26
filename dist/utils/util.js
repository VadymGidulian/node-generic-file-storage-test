"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPath = void 0;
const promises_1 = __importDefault(require("fs/promises"));
async function checkPath(path) {
    try {
        await promises_1.default.access(path);
        return path;
    }
    catch {
        return null;
    }
}
exports.checkPath = checkPath;
//# sourceMappingURL=util.js.map