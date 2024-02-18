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
exports.initWs = void 0;
const socket_io_1 = require("socket.io");
const aws_1 = require("./aws");
const path_1 = __importDefault(require("path"));
const fs_1 = require("./fs");
const pty_1 = require("./pty");
const terminalManager = new pty_1.TerminalManager();
function initWs(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            // Should restrict this more!
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    io.on("connection", (socket) => __awaiter(this, void 0, void 0, function* () {
        // Auth checks should happen here
        const replId = socket.handshake.query.roomId;
        if (!replId) {
            socket.disconnect();
            terminalManager.clear(socket.id);
            return;
        }
        yield (0, aws_1.fetchS3Folder)(`code/${replId}`, path_1.default.join(__dirname, `../tmp/${replId}`));
        socket.emit("loaded", {
            rootContent: yield (0, fs_1.fetchDir)(path_1.default.join(__dirname, `../tmp/${replId}`), "")
        });
        initHandlers(socket, replId);
    }));
}
exports.initWs = initWs;
function initHandlers(socket, replId) {
    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
    socket.on("fetchDir", (dir, callback) => __awaiter(this, void 0, void 0, function* () {
        const dirPath = path_1.default.join(__dirname, `../tmp/${replId}/${dir}`);
        const contents = yield (0, fs_1.fetchDir)(dirPath, dir);
        callback(contents);
    }));
    socket.on("fetchContent", ({ path: filePath }, callback) => __awaiter(this, void 0, void 0, function* () {
        const fullPath = path_1.default.join(__dirname, `../tmp/${replId}/${filePath}`);
        const data = yield (0, fs_1.fetchFileContent)(fullPath);
        callback(data);
    }));
    // TODO: contents should be diff, not full file
    // Should be validated for size
    // Should be throttled before updating S3 (or use an S3 mount)
    socket.on("updateContent", ({ path: filePath, content }) => __awaiter(this, void 0, void 0, function* () {
        const fullPath = path_1.default.join(__dirname, `../tmp/${replId}/${filePath}`);
        yield (0, fs_1.saveFile)(fullPath, content);
        yield (0, aws_1.saveToS3)(`code/${replId}`, filePath, content);
    }));
    socket.on("requestTerminal", () => __awaiter(this, void 0, void 0, function* () {
        terminalManager.createPty(socket.id, replId, (data, id) => {
            socket.emit('terminal', {
                data: Buffer.from(data, "utf-8")
            });
        });
    }));
    socket.on("terminalData", ({ data }) => __awaiter(this, void 0, void 0, function* () {
        terminalManager.write(socket.id, data);
    }));
}
