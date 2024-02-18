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
exports.initHttp = void 0;
const aws_1 = require("./aws");
const express_1 = __importDefault(require("express"));
function initHttp(app) {
    app.use(express_1.default.json());
    app.post("/project", (req, res) => __awaiter(this, void 0, void 0, function* () {
        // Hit a database to ensure this slug isn't taken already
        const { replId, language } = req.body;
        if (!replId) {
            res.status(400).send("Bad request");
            return;
        }
        yield (0, aws_1.copyS3Folder)(`base/${language}`, `code/${replId}`);
        res.send("Project created");
    }));
}
exports.initHttp = initHttp;
