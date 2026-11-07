import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {writeFile,mkdir} from 'node:fs/promises';
const result=await build({entryPoints:['src/config/legalContent.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
const mod={exports:{}};
runInNewContext(result.outputFiles[0].text,{module:mod,exports:mod.exports});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
await mkdir('public',{recursive:true});
for(const [file,title,sections] of [
 ['politica-de-privacidade.html','Política de Privacidade',mod.exports.privacySections],
 ['termos-de-uso.html','Termos de Uso',mod.exports.termsSections],
]){
 const content=sections.map(([heading,text])=>`<section><h2>${esc(heading)}</h2><p>${esc(text)}</p></section>`).join('');
 await writeFile('public/'+file,`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | ZM SCD</title><meta name="description" content="${esc(title)} da página de simulação e encaminhamento ZM SCD."><style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#334155;line-height:1.7;margin:0;padding:24px}main{max-width:760px;margin:auto;padding:32px;background:white;border:1px solid #cbd5e1;border-radius:16px}h1,h2{color:#0f172a}h2{font-size:1.1rem}section{margin:28px 0}a{color:#1d4ed8}</style></head><body><main><a href="/">Voltar ao simulador</a><h1>${esc(title)}</h1>${content}<p>Atualização: 7 de novembro de 2026.</p><a href="https://zmscd.online/">Voltar ao site ZM SCD</a></main></body></html>\n`);
}
