import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { saveToS3 } from "./aws";
import path from "path";
import { fetchDir, fetchFileContent, saveFile } from "./fs";
import { TerminalManager } from "./pty";
import diff from "diff";

const terminalManager = new TerminalManager();
const THROTTLE_DELAY = 500; // milliseconds

// Send diff to the client
function sendDiff(socket: Socket, filePath: string, oldContent: string, newContent: string) {
    const changes = diff.diffLines(oldContent, newContent);
    socket.emit('contentDiff', { path: filePath, changes });
}

export function initWs(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            // Should restrict this more!
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", async (socket) => {
        const host = socket.handshake.headers.host;
        console.log(`host is ${host}`);
        const replId = host?.split('.')[0];

        if (!replId) {
            socket.disconnect();
            terminalManager.clear(socket.id);
            return;
        }

        socket.emit("loaded", {
            rootContent: await fetchDir(`/workspace/${replId}`, "")
        });

        initHandlers(socket, replId);
    });
}

function initHandlers(socket: Socket, replId: string) {

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });

    socket.on("fetchDir", async (dir: string, callback) => {
        const dirPath = `/workspace/${replId}/${dir}`;
        const contents = await fetchDir(dirPath, dir);
        callback(contents);
    });

    socket.on("fetchContent", async ({ path: filePath }: { path: string }, callback) => {
        const fullPath = `/workspace/${replId}/${filePath}`;
        const data = await fetchFileContent(fullPath);
        callback(data);
    });

    socket.on("updateContent", async ({ path: filePath, content }: { path: string, content: string }) => {
        const fullPath = `/workspace/${replId}/${filePath}`;
        const oldContent = await fetchFileContent(fullPath);
        if (content.length > MAX_CONTENT_SIZE) {
            console.error(`Content size exceeds maximum allowed size for ${filePath}`);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
        await saveFile(fullPath, content);
        sendDiff(socket, filePath, oldContent, content);
        await saveToS3(`code/${replId}`, filePath, content);
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
}
