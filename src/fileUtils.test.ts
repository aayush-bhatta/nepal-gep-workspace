import {describe,it,expect} from 'vitest';
import {parseCsv,colabUrl,fileExtension,safeExternalUrl,bytes} from './fileUtils';
describe('research file preview utilities',()=>{
  it('parses quoted commas, line breaks and escaped quotes',()=>{
    const value=parseCsv('date,demand\r\n"2030,Jan","10"\r\n"line\nbreak","a""b"\r\n');
    expect(value.columns).toEqual(['date','demand']);
    expect(value.rows).toEqual([['2030,Jan','10'],['line\nbreak','a"b']]);
  });
  it('does not confuse external notebooks with private Supabase data',()=>{
    expect(colabUrl('https://github.com/aayush-bhatta/nepal-gep-workspace/blob/main/Models/example.ipynb')).toBe('https://colab.research.google.com/github/aayush-bhatta/nepal-gep-workspace/blob/main/Models/example.ipynb');
    expect(colabUrl('https://drive.google.com/file/d/abc_123/view')).toBe('https://colab.research.google.com/drive/abc_123');
    expect(colabUrl('https://example.org/secret.ipynb')).toBe(null);
    expect(safeExternalUrl('javascript:alert(1)')).toBe(null);
  });
  it('classifies filenames and byte units',()=>{
    expect(fileExtension('GEPLoad.CSV')).toBe('csv');
    expect(bytes(0)).toBe('0 B');
  });
});
