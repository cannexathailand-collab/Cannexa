import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatStrainResearch} from '../src/lib/research-strain-format';
test('locked strain summaries keep ratios, THC and source without inventing missing values',()=>{
 const source='https://example.com/reference';
 const text=formatStrainResearch('Example',{thc:'20–25%',indicaPercent:70,sativaPercent:30,genetics:'Parents',aromaFlavor:'Citrus',effects:'Reported relaxation'},[source]);
 assert.match(text,/Indica 70% \/ Sativa 30% \| THC 20–25%/);
 assert.ok(text.endsWith(source));
 const unknown=formatStrainResearch('Unknown',{},[source]);
 assert.match(unknown,/Indica not reported \/ Sativa not reported \| THC Not reported/);
 const long=formatStrainResearch('Example',{thc:'25%',indicaPercent:50,sativaPercent:50,genetics:'a'.repeat(300),aromaFlavor:'b'.repeat(300),effects:'c'.repeat(300)},[source]);
 assert.ok(long.length<=500);assert.ok(long.endsWith(source));
 for(const label of ['Strain Name:','Type:','Genetics:','Aroma and Flavor:','Benefits:'])assert.ok(long.includes(label));
});
