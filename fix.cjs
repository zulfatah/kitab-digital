const fs = require('fs');

let file = 'src/types.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/nodeType: ch.parentId \? \(ch.nodeType && ch.nodeType !== 'Bab' \? ch.nodeType : 'Fasal'\) : \(ch.nodeType && ch.nodeType !== 'Fasal' \? ch.nodeType : 'Bab'\)/g, 'nodeType: ch.nodeType || ""');
content = content.replace(/migrated.nodeType = migrated.isSubChapter \? 'Fasal' : 'Bab';/g, 'migrated.nodeType = "";');
fs.writeFileSync(file, content);

file = 'src/components/CollaborativeEditor.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/\{ch\.nodeType \|\| \(ch\.parentId \? 'Fasal' : 'Bab'\)\}/g, '{ch.nodeType}');
content = content.replace(/nodeType: 'Bab'/g, 'nodeType: ""');
content = content.replace(/nodeType: 'Fasal'/g, 'nodeType: ""');
fs.writeFileSync(file, content);

file = 'src/components/KitabWriter.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/\{ch\.nodeType \|\| \(ch\.parentId \? 'Fasal' : 'Bab'\)\}/g, '{ch.nodeType}');
content = content.replace(/nodeType: 'Bab'/g, 'nodeType: ""');
content = content.replace(/nodeType: 'Fasal'/g, 'nodeType: ""');
fs.writeFileSync(file, content);
