export enum Type {
  FILE,
  DIRECTORY,
  DUMMY
}

interface CommonProps {
  id: string; // 文件id
  type: Type; // 文件类型
  name: string; // 名称
  content?: string;
  path: string;
  parentId: string | undefined; // 父级目录，如果为根目录则undefined
  depth: number; // 文件深度
}

export interface File extends CommonProps {
  
}

export interface RemoteFile {
  type: "file" | "dir";
  name: string;
  path: string;
}

export interface Directory extends CommonProps {
  files: File[];
  dirs: Directory[];
}

/**
 * 构建文件树
 * @param data fetch获取的结果
 */
export function buildFileTree(data: RemoteFile[]): Directory {
  const dirs = data.filter(x => x.type === "dir");
  const files = data.filter(x => x.type === "file");
  const cache = new Map<string, Directory | File>(); // 缓存
  // 待构建的根目录
  let rootDir: Directory = {
    id: "root",
    name: "root",
    parentId: undefined,
    type: Type.DIRECTORY,
    path: "",
    depth: 0,
    dirs: [],
    files: []
  };
  // 将<id，目录对象>存入map
  dirs.forEach((item) => {
    let dir: Directory = {
      id: item.path,
      name: item.name,
      path: item.path,
      parentId: item.path.split("/").length === 2 ? "0" : dirs.find(x => x.path === item.path.split("/").slice(0, -1).join("/"))?.path,
      type: Type.DIRECTORY,
      depth: 0,
      dirs: [],
      files: []
    };

    cache.set(dir.id, dir);
  });
  // 将<id，文件对象>存入map
  files.forEach((item) => {
    let file: File = {
      id: item.path,
      name: item.name,
      path: item.path,
      parentId: item.path.split("/").length === 2 ? "0" : dirs.find(x => x.path === item.path.split("/").slice(0, -1).join("/"))?.path,
      type: Type.FILE,
      depth: 0
    };
    cache.set(file.id, file);
  });
  // 开始遍历构建文件树
  cache.forEach((value, key) => {
    // '0'表示文件或目录位于根目录
    if (value.parentId === "0") {
      if (value.type === Type.DIRECTORY) rootDir.dirs.push(value as Directory);
      else rootDir.files.push(value as File);
    } else {
      const parentDir = cache.get(value.parentId as string) as Directory;
      if (value.type === Type.DIRECTORY)
        parentDir.dirs.push(value as Directory);
      else parentDir.files.push(value as File);
    }
  });

  // 获取文件深度
  getDepth(rootDir, 0);

  return rootDir;
}

/**
 * 获取文件深度
 * @param rootDir 根目录
 * @param curDepth 当前深度
 */
function getDepth(rootDir: Directory, curDepth: number) {
  rootDir.files.forEach((file) => {
    file.depth = curDepth + 1;
  });
  rootDir.dirs.forEach((dir) => {
    dir.depth = curDepth + 1;
    getDepth(dir, curDepth + 1);
  });
}

export function findFileByName(
  rootDir: Directory,
  filename: string
): File | undefined {
  let targetFile: File | undefined = undefined;

  function findFile(rootDir: Directory, filename: string) {
    rootDir.files.forEach((file) => {
      if (file.name === filename) {
        targetFile = file;
        return;
      }
    });
    rootDir.dirs.forEach((dir) => {
      findFile(dir, filename);
    });
  }

  findFile(rootDir, filename);
  return targetFile;
}

export function sortDir(l: Directory, r: Directory) {
  return l.name.localeCompare(r.name);
}

export function sortFile(l: File, r: File) {
  return l.name.localeCompare(r.name);
}
