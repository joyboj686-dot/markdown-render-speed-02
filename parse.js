// Fast, dependency-free Markdown renderer with CommonMark and GFM block rules.
const ESC = /[&<>"']/g;
function esc(s) { return s.replace(ESC, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'); }
function decodeEntities(s) { return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (all, x) => { if (x[0]==='#') { let n=x[1].toLowerCase()==='x'?parseInt(x.slice(2),16):parseInt(x.slice(1),10); return !Number.isFinite(n)||n===0||n>0x10ffff?'�':String.fromCodePoint(n); } const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',copy:'©',reg:'®',ouml:'ö'}; return named[x.toLowerCase()]??all; }); }
function attr(s) { return esc(s).replace(/&#39;/g, '&#39;').replace(/\\/g, '%5C'); }
function norm(src) { return src.replace(/\r\n?/g, '\n').replace(/\0/g, '�'); }

function splitCells(s) {
  let a = [], cur = '', slash = false, code = false;
  for (let i=0;i<s.length;i++) { const c=s[i]; if (c==='\\' && !slash) { slash=true; cur+=c; continue; } if (c==='`' && !slash) code=!code; if (c==='|' && !slash && !code) { a.push(cur); cur=''; } else cur+=c; slash=false; }
  a.push(cur); if (a[0].trim()==='') a.shift(); if (a.at(-1).trim()==='') a.pop(); return a.map(x=>x.trim());
}
function inline(src, refs, inLink=false) {
  let out='', i=0, text='';
  const flush=()=>{ if(text){ out+=esc(text); text=''; } };
  while(i<src.length) {
    let c=src[i];
    if(c==='\\') { if(i+1<src.length && /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/.test(src[i+1])) { text+=src[i+1]; i+=2; continue; } if(src[i+1]==='\n'){flush();out+='<br>\n';i+=2;continue;} text+=c;i++;continue; }
    if(c==='\n'){ flush(); out+=(src[i-1]===' '&&src[i-2]===' ')?'<br>':'\n'; i++; continue; }
    if(c==='`') { let n=1; while(src[i+n]==='`')n++; const mark='`'.repeat(n), j=src.indexOf(mark,i+n); if(j>=0){flush();let v=src.slice(i+n,j).replace(/\n/g,' ');if(/^\s.*\s$/.test(v)&&/\S/.test(v))v=v.slice(1,-1);out+='<code>'+esc(v)+'</code>';i=j+n;continue;} }
    if(c==='&') { const m=src.slice(i).match(/^&(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/); if(m){flush();out+=decodeEntities(m[0]);i+=m[0].length;continue;} }
    if(c==='<' ) { const m=src.slice(i).match(/^<((?:https?:\/\/|mailto:)[^ <>]+)>/i); if(m){flush();let u=m[1], label=u.startsWith('mailto:')?u.slice(7):u;out+='<a href="'+attr(u)+'">'+esc(label)+'</a>';i+=m[0].length;continue;} const t=src.slice(i).match(/^<([A-Za-z][^<>]*?)>/); if(t){flush();out+=t[0];i+=t[0].length;continue;} }
    if(!inLink && (c==='!' || c==='[')) { const image=c==='!'; const st=i+(image?1:0); if(src[st]==='['){ const close=src.indexOf(']',st+1); if(close>=0){let label=src.slice(st+1,close), end=close+1, url=null,title=''; if(src[end]==='('){let k=end+1, depth=0;while(k<src.length){if(src[k]==='(')depth++;else if(src[k]===')'){if(depth===0)break;depth--;}k++;}if(k<src.length){let inside=src.slice(end+1,k).trim(), mm=inside.match(/^(?:<([^>]*)>|(\S+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?$/);if(mm){url=mm[1]??mm[2];title=mm[3]??mm[4]??mm[5]??'';end=k+1;}}} else if(src[end]==='['){let k=src.indexOf(']',end+1);if(k>=0){let key=(src.slice(end+1,k)||label).toLowerCase().replace(/\s+/g,' ');if(refs[key]){url=refs[key][0];title=refs[key][1];end=k+1;}}} else {let key=label.toLowerCase().replace(/\s+/g,' ');if(refs[key]){url=refs[key][0];title=refs[key][1];end=close+1;}} if(url!==null){flush();if(image)out+='<img src="'+attr(url)+'" alt="'+attr(label)+'"'+(title?' title="'+attr(title)+'"':'')+'>';else out+='<a href="'+attr(url)+'"'+(title?' title="'+attr(title)+'"':'')+'>'+inline(label,refs,true)+'</a>';i=end;continue;}}}}
    if(c==='*'||c==='_'){let n=1;while(src[i+n]===c)n++;let use=n>=2?2:1;let mark=c.repeat(use),j=src.indexOf(mark,i+use);if(j>i+use && (use===2||src[i+use]!==' ')){flush();out+=(use===2?'<strong>':'<em>')+inline(src.slice(i+use,j),refs,inLink)+(use===2?'</strong>':'</em>');i=j+use;continue;}}
    if(c==='~'&&src[i+1]==='~'){let j=src.indexOf('~~',i+2);if(j>i+2){flush();out+='<del>'+inline(src.slice(i+2,j),refs,inLink)+'</del>';i=j+2;continue;}}
    text+=c;i++;
  } flush(); return out;
}
function parse(markdown) {
  let s=norm(String(markdown)), lines=s.split('\n'), refs=Object.create(null), kept=[];
  for(let i=0;i<lines.length;i++){let m=lines[i].match(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/);if(m){refs[m[1].toLowerCase().replace(/\s+/g,' ')]=[m[2]??m[3],m[4]??m[5]??m[6]??''];kept.push(null);}else kept.push(lines[i]);}
  lines=kept; let out='', i=0;
  const isBlank=x=>x==null||/^\s*$/.test(x);
  while(i<lines.length){let line=lines[i];if(isBlank(line)){i++;continue;}
    let m=line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/);if(m){let body=m[2].replace(/[ \t]+#+[ \t]*$/,'');out+='<h'+m[1].length+'>'+inline(body,refs)+'</h'+m[1].length+'>\n';i++;continue;}
    if(/^ {0,3}(?:\*\s*){3,}$|^ {0,3}(?:-\s*){3,}$|^ {0,3}(?:_\s*){3,}$/.test(line)){out+='<hr>\n';i++;continue;}
    m=line.match(/^ {0,3}(```+|~~~+)[ \t]*(.*)$/);if(m){let fence=m[1], info=m[2].trim(), body=[];i++;while(i<lines.length&&!new RegExp('^ {0,3}'+fence[0]+'{'+fence.length+',}[ \\t]*$').test(lines[i]))body.push(lines[i++]);if(i<lines.length)i++;out+='<pre><code'+(info?' class="language-'+esc(info.split(/[ \t]+/)[0])+'"':'')+'>'+esc(body.join('\n')+(body.length?'\n':''))+'</code></pre>\n';continue;}
    if(/^ {0,3}>/.test(line)){let b=[];while(i<lines.length&&(/^ {0,3}>/.test(lines[i])||isBlank(lines[i]))){b.push(lines[i]==null?'':lines[i].replace(/^ {0,3}>[ \t]?/,''));i++;}out+='<blockquote>\n'+parse(b.join('\n'))+'</blockquote>\n';continue;}
    if(/^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/.test(line)){let first=line.match(/^ {0,3}([-+*]|\d+[.)])[ \t]+(.*)$/), ordered=/^\d/.test(first[1]), start=ordered?parseInt(first[1]):1, items=[];while(i<lines.length){let q=lines[i].match(/^ {0,3}([-+*]|\d+[.)])[ \t]+(.*)$/);if(!q||/^\d/.test(q[1])!==ordered)break;let content=q[2], task='';if(/^\[[ xX]\][ \t]+/.test(content)){task=content[1].toLowerCase()==='x'?' checked':' disabled';content=content.slice(4);}items.push('<li'+(task?' class="task-list-item"':'')+'>'+(task?'<input'+task+' type="checkbox"> ':'')+inline(content,refs)+'</li>');i++;}let tag=ordered?'ol':'ul';out+='<'+tag+(ordered&&start!==1?' start="'+start+'"':'')+'>'+items.join('')+'</'+tag+'>\n';continue;}
    if(i+1<lines.length&&/^ {0,3}(?:=+|-+)\s*$/.test(lines[i+1])&&line.trim()){let lev=lines[i+1].trim()[0]==='='?1:2;out+='<h'+lev+'>'+inline(line.trim(),refs)+'</h'+lev+'>\n';i+=2;continue;}
    let para=[line];i++;while(i<lines.length&&!isBlank(lines[i])&&!/^ {0,3}(?:#{1,6})[ \t]/.test(lines[i])&&!/^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/.test(lines[i])&&!/^ {0,3}>/.test(lines[i]))para.push(lines[i++]);
    let raw=para.join('\n');out+='<p>'+inline(raw,refs)+'</p>\n';
  } return out;
}
export { parse };
