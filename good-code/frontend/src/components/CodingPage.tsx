import { useEffect, useState } from 'react';
import { Socket, io } from 'socket.io-client';
import { Editor } from './Editor';
import { File, RemoteFile, Type } from './external/editor/utils/file-manager';
import { useSearchParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { Output } from './Output';
import { TerminalComponent as Terminal } from './Terminal';
import axios from 'axios';

function useSocket(replId: string) {
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const newSocket = io(`ws://${replId}.peetcode.com`);
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [replId]);

    return socket;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end; /* Aligns children (button) to the right */
  padding: 10px; /* Adds some space around the button */
`;

const Workspace = styled.div`
  display: flex;
  margin: 0;
  font-size: 16px;
  width: 100%;
`;

const LeftPanel = styled.div`
  flex: 1;
  width: 60%;
`;

const RightPanel = styled.div`
  flex: 1;
  width: 40%;
`;


export const CodingPage = () => {
    const [podCreated, setPodCreated] = useState(false);
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';
    
    useEffect(() => {
        if (replId) {
            axios.post(`http://localhost:3002/start`, { replId })
                .then(() => setPodCreated(true))
                .catch((err) => console.error(err));
        }
    }, []);

    if (!podCreated) {
        return <>Booting...</>
    }
    return <CodingPagePostPodCreation />

}

export const CodingPagePostPodCreation = () => {
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';
    const [loaded, setLoaded] = useState(false);
    const socket = useSocket(replId);
    const [fileStructure, setFileStructure] = useState<RemoteFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
    const [showOutput, setShowOutput] = useState(false);

    useEffect(() => {
        if (socket) {
            socket.on('loaded', ({ rootContent }: { rootContent: RemoteFile[]}) => {
                setLoaded(true);
                setFileStructure(rootContent);
            });
        }
    }, [socket]);

    const onSelect = (file: File) => {
        if (file.type === Type.DIRECTORY) {
            socket?.emit("fetchDir", file.path, (data: RemoteFile[]) => {
                setFileStructure(prev => {
                    const allFiles = [...prev, ...data];
                    return allFiles.filter((file, index, self) => 
                        index === self.findIndex(f => f.path === file.path)
                    );
                });
            });
        } else {
            socket?.emit("fetchContent", { path: file.path }, (data: string) => {
                file.content = data;
                setSelectedFile(file);
            });
        }
    };
    
    if (!loaded) {
        return "Loading...";
    }

    return (
        <Container>
             <ButtonContainer>
                <button onClick={() => setShowOutput(!showOutput)}>See output</button>
            </ButtonContainer>
            <Workspace>
                <LeftPanel>
                    <Editor socket={socket} selectedFile={selectedFile} onSelect={onSelect} files={fileStructure} />
                </LeftPanel>
                <RightPanel>
                    {showOutput && <Output />}
                    <Terminal socket={socket} />
                </RightPanel>
            </Workspace>
        </Container>
    );
}
