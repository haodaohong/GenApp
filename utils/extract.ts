export function extractAllFilePathsAndContents(text: string) {
    // 全局正则表达式，匹配所有 boltAction 元素
    const regex = /<boltAction type="file" filePath="([^"]+)">([\s\S]*?)<\/boltAction>/g;
    
    const matches = [];
    let match: RegExpExecArray | null;
    
    // 使用循环获取所有匹配项
    match = regex.exec(text);
    while (match !== null) {
      matches.push({
        path: match[1],
        content: match[2].trim()
      });
      match = regex.exec(text);
    }
    
    return matches;
  }