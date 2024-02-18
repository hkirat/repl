import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { fetchS3Folder, saveToS3 } from "./aws";
import path from "path";
import { fetchDir, fetchFileContent, saveFile } from "./fs";
import { TerminalManager } from "./pty";
import { diff_match_patch } from "diff-match-patch";

const terminalManager = new TerminalManager();
const dmp = new diff_match_patch();

export function initWs(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", async (socket) => {
        // Auth checks
        const replId = socket.handshake.query.roomId as string;

        if (!replId) {
            socket.disconnect();
            terminalManager.clear(socket.id);
            return;
        }

        await fetchS3Folder(`code/${replId}`, path.join(__dirname, `../tmp/${replId}`));
        socket.emit("loaded", {
            rootContent: await fetchDir(path.join(__dirname, `../tmp/${replId}`), "")
        });

        initHandlers(socket, replId);
    });
}

function initHandlers(socket: Socket, replId: string) {

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });

    socket.on("fetchDir", async (dir: string, callback) => {
        const dirPath = path.join(__dirname, `../tmp/${replId}/${dir}`);
        const contents = await fetchDir(dirPath, dir);
        callback(contents);
    });

    socket.on("fetchContent", async ({ path: filePath }: { path: string }, callback) => {
        const fullPath = path.join(__dirname, `../tmp/${replId}/${filePath}`);
        const data = await fetchFileContent(fullPath);
        callback(data);
    });

    socket.on("updateContent", async ({ path: filePath, content }: { path: string, content: string }) => {
        const fullPath = path.join(__dirname, `../tmp/${replId}/${filePath}`);
        const existingContent = await fetchFileContent(fullPath);
        const patches = dmp.patch_make(existingContent, content);
        const patchedContent = dmp.patch_apply(patches, existingContent)[0];
        await saveFile(fullPath, patchedContent);
        await saveToS3(`code/${replId}`, filePath, patchedContent);
    });

    socket.on("requestTerminal", async () => {
        terminalManager.createPty(socket.id, replId, (data, id) => {
            socket.emit('terminal', {
                data: Buffer.from(data, "utf-8")
            });
        });
    });

    socket.on("terminalData", async ({ data }: { data: string, terminalId: number }) => {
        terminalManager.write(socket.id, data);
    });

    // Throttle updates to S3
    let canUpdateS3 = true;
    socket.on("updateContent", async ({ path: filePath, content }: { path: string, content: string }) => {
        if (!canUpdateS3) return;
        canUpdateS3 = false;
        setTimeout(() => {
            canUpdateS3 = true;
        }, 1000);
        const fullPath = path.join(__dirname, `../tmp/${replId}/${filePath}`);
        const existingContent = await fetchFileContent(fullPath);
        const patches = dmp.patch_make(existingContent, content);
        const patchedContent = dmp.patch_apply(patches, existingContent)[0];
        await saveFile(fullPath, patchedContent);
        await saveToS3(`code/${replId}`, filePath, patchedContent);
    });
}
