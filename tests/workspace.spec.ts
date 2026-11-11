import {test,expect} from '@playwright/test';
import JSZip from 'jszip';
function pdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 5 0 R >>','<< /Length 24 >>\nstream\n0 0 1 rg 20 20 80 80 re f\nendstream'];
 let text='%PDF-1.4\n';const offsets=[0];objects.forEach((s,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${s}\nendobj\n`;});const start=Buffer.byteLength(text);text+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(text);
}
async function workbook(){const z=new JSZip();z.file('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Demand" r:id="rId1"/></sheets></workbook>');z.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');z.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>MW</t></is></c></row><row><c r="A2"><v>1200</v></c></row></sheetData></worksheet>');return z.generateAsync({type:'nodebuffer'});}
test.beforeEach(async({page})=>{
 const contents:Record<string,Buffer|string>={pdf:pdf(),pdfold:pdf(),csv:'year,demand\n2030,1200',py:'print("never executed")',ipynb:JSON.stringify({cells:[{cell_type:'code',source:['print("not executed")']}]}),xlsx:await workbook(),png:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')};
 const files=Object.keys(contents).filter(ext=>ext!=='pdfold').map((ext,i)=>({id:`file-${i}`,original_name:`research.${ext}`,storage_path:`objects/${ext}`,folder_path:'Data/Demand',byte_size:100,current_version:ext==='pdf'?2:1,external_url:ext==='ipynb'?'https://github.com/example/research/blob/main/model.ipynb':null}));
 await page.route('https://**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname!=='fixture.supabase.co')return route.abort();
  if(u.pathname.includes('/storage/v1/object/'))return route.fulfill({body:contents[u.pathname.split('/').at(-1)!]||'',contentType:'application/octet-stream'});
  const table=u.pathname.split('/').at(-1)!;
  if(u.pathname.includes('/rpc/'))return route.fulfill({status:400,json:{message:'Folder contains files or subfolders',code:'P0001'}});
  if(route.request().method()==='PATCH')return route.fulfill({json:{}});
  return route.fulfill({json:table==='files'?files:table==='file_versions'?[{id:'pdf-history',file_id:'file-0',version_number:1,original_name:'previous.pdf',storage_path:'objects/pdfold',byte_size:100}]:table==='folders'?[{id:'folder',path:'Data/Demand'}]:[]});
 });
 await page.goto('/nepal-gep-workspace/tests/browser.html');
 await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('button',{name:'Demand',exact:true}).click();
});
test('private PDF uses real canvas rendering, page navigation and zoom without a native PDF plugin',async({page})=>{
 await page.getByRole('row').filter({hasText:'research.pdf'}).getByRole('button',{name:'Preview',exact:true}).click();
 const canvas=page.getByRole('dialog').locator('canvas');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('width','300');
 expect(await canvas.evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(30,350,1,1).data))).toEqual([0,0,255,255]);
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(canvas).toHaveAttribute('width','375');
 await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(canvas).toHaveAttribute('aria-label','PDF page 2');await expect(canvas).toBeVisible();
 await expect(page.locator('iframe,embed,object')).toHaveCount(0);
});
for(const [extension,content] of [['csv','1200'],['xlsx','1200'],['py','never executed'],['ipynb','not executed']])test(`${extension} safe source preview`,async({page})=>{
 await page.getByRole('row').filter({hasText:`research.${extension}`}).getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText(content);
 if(extension==='ipynb')await expect(page.getByRole('link',{name:'Open linked Colab notebook'})).toHaveAttribute('href','https://colab.research.google.com/github/example/research/blob/main/model.ipynb');
});
test('image preview and provenance remain available',async({page})=>{
 const row=page.getByRole('row').filter({hasText:'research.png'});await row.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('img',{name:'Preview of research.png'})).toBeVisible();
 await page.getByRole('button',{name:'Close',exact:true}).click();await row.getByRole('button',{name:'Details',exact:true}).click();await expect(page.getByText('Research notes / assumptions')).toBeVisible();await expect(page.getByText('Page, table, figure or DOI')).toBeVisible();
});
test('nonempty folders including descendants are protected',async({page})=>{
 await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('button',{name:'Delete Data/Demand',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Folder contains files');
});
test('Supabase RPC failures show a readable message and code',async({page})=>{
 await page.getByRole('button',{name:'Data',exact:true}).click();let prompts=0;
 page.on('dialog',dialog=>dialog.accept(prompts++===0?'Demand renamed':'Data'));
 await page.getByRole('button',{name:'Rename or move Data/Demand',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Folder contains files or subfolders · P0001');
});

test('folder selection clears cross-folder search',async({page})=>{
 await page.getByPlaceholder('Search filename or source title across all folders').fill('research.pdf');
 await page.getByRole('button',{name:'Root folders',exact:true}).click();
 await expect(page.getByPlaceholder('Search filename or source title across all folders')).toHaveValue('');
 await expect(page.getByRole('button',{name:'Data',exact:true})).toBeVisible();
});

test('historical PDF preview resets zoom/page and downloads the selected private version',async({page})=>{
 await page.getByRole('row').filter({hasText:'research.pdf'}).getByRole('button',{name:'Preview',exact:true}).click();
 const canvas=page.getByRole('dialog').locator('canvas');await expect(canvas).toBeVisible();
 await page.getByRole('button',{name:'Next page',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await page.getByRole('dialog').getByRole('combobox').first().selectOption('pdf-history');
 await expect(canvas).toHaveAttribute('aria-label','PDF page 1');await expect(canvas).toHaveAttribute('width','300');await expect(canvas).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download this version'}).click();expect((await download).suggestedFilename()).toBe('previous.pdf');
});
test('citation and assumption saves send the original metadata fields',async({page})=>{
 await page.getByRole('row').filter({hasText:'research.pdf'}).getByRole('button',{name:'Details',exact:true}).click();
 await page.getByLabel('Research notes / assumptions').fill('Dry-year demand assumption');
 await page.getByLabel('Page, table, figure or DOI').fill('Table 4; doi:10.example/test');
 const request=page.waitForRequest(r=>r.method()==='PATCH');await page.getByRole('button',{name:'Save provenance'}).click();
 expect((await request).postDataJSON()).toMatchObject({notes:'Dry-year demand assumption',source_reference:'Table 4; doi:10.example/test'});
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('folder rename and move use the existing transactional RPC and keep files reachable',async({page})=>{
 let moved=false;
 await page.route('**/rest/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/rpc/gep_move_folder')){
   expect(route.request().postDataJSON()).toEqual({p_old_path:'Data/Demand',p_destination:'Results',p_name:'Renamed demand'});moved=true;return route.fulfill({json:'Results/Renamed demand'});
  }
  if(path.endsWith('/folders'))return route.fulfill({json:[{id:'data',path:'Data'},{id:'results',path:'Results'},{id:'demand',path:moved?'Results/Renamed demand':'Data/Demand'}]});
  if(moved&&path.endsWith('/files'))return route.fulfill({json:[{id:'moved-file',original_name:'moved.csv',storage_path:'objects/csv',folder_path:'Results/Renamed demand',byte_size:100}]});
  return route.fallback();
 });
 await page.getByRole('button',{name:'Data',exact:true}).click();let prompts=0;page.on('dialog',dialog=>dialog.accept(prompts++===0?'Renamed demand':'Results'));
 await page.getByRole('button',{name:'Rename or move Data/Demand',exact:true}).click();await expect(page.getByRole('status')).toContainText('completed');
 await page.getByRole('button',{name:'Root folders',exact:true}).click();await page.getByRole('button',{name:'Results',exact:true}).click();await page.getByRole('button',{name:'Renamed demand',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'moved.csv'})).toBeVisible();
});
test('empty-folder deletion calls the protected RPC after confirmation',async({page})=>{
 let deleted=false;await page.route('**/rest/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/folders'))return route.fulfill({json:deleted?[]:[{id:'empty',path:'Empty'}]});
  if(path.endsWith('/rpc/gep_delete_empty_folder')){expect(route.request().postDataJSON()).toEqual({p_path:'Empty'});deleted=true;return route.fulfill({json:true});}
  return route.fallback();
 });
 await page.getByRole('button',{name:'Root folders',exact:true}).click();await page.getByRole('button',{name:'Refresh',exact:true}).click();page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Delete Empty',exact:true}).click();await expect(page.getByRole('button',{name:'Empty',exact:true})).toHaveCount(0);expect(deleted).toBe(true);
});
