const fs = require('fs');
let content = fs.readFileSync('src/components/CollaborativeEditor.tsx', 'utf8');
content = content.replace(/\{ch\.nodeType \|\| \(ch\.parentId \? 'Fasal' : 'Bab'\)\} \{ch\.number\}/g, '{ch.number}');
fs.writeFileSync('src/components/CollaborativeEditor.tsx', content);
