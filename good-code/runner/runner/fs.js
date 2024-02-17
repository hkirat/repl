"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveFile = exports.fetchFileContent = exports.fetchDir = void 0;
const fs_1 = __importDefault(require("fs"));
const fetchDir = (dir, baseDir) => {
    return new Promise((resolve, reject) => {
        fs_1.default.readdir(dir, { withFileTypes: true }, (err, files) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(files.map(file => ({ type: file.isDirectory() ? "dir" : "file", name: file.name, path: `${baseDir}/${file.name}` })));
            }
        });
    });
};
exports.fetchDir = fetchDir;
const fetchFileContent = (file) => {
    return new Promise((resolve, reject) => {
        fs_1.default.readFile(file, "utf8", (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
};
exports.fetchFileContent = fetchFileContent;
const saveFile = (file, content) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        fs_1.default.writeFile(file, content, "utf8", (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
});
exports.saveFile = saveFile;
