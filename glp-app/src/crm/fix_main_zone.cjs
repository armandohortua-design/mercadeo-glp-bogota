const fs = require('fs');

const path = 'c:/Users/ahortua/OneDrive/Juan Jose/Mercadeo GLP en Bogota/glp-app/src/main.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace project.zoneShort with project.zone.split(',')[0]
code = code.split('project.zoneShort').join("project.zone.split(',')[0]");

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully fixed zoneShort in main.tsx');
