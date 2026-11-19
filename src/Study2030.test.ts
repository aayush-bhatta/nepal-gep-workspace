import {describe,expect,it} from 'vitest';
import {capacity} from './Study2030';
import {monthlyCalibration2030,ROR_CF,PROR_CF,STORAGE_CF} from './Study2030Methodology';

describe('2030 evidence-first methodology matches the supplied Colab notebook',()=>{
 const days=monthlyCalibration2030.reduce((s,r)=>s+r.days,0);
 const weighted=(key:'ror_avail'|'pror_inflow'|'solar_mean')=>
  monthlyCalibration2030.reduce((s,r)=>s+r.days*r[key],0)/days;
 it('preserves the 2026 existing / new 2030 / 2030 total capacity accounting',()=>{
  expect(capacity.reduce((s,r)=>s+r.Existing_2026_MW_scenario,0)).toBeCloseTo(4056.306,3);
  expect(capacity.reduce((s,r)=>s+r.Optimized_New_MW,0)).toBeCloseTo(4921.181806,3);
  expect(capacity.reduce((s,r)=>s+r.Total_2030_MW,0)).toBeCloseTo(8977.487806,3);
  capacity.forEach(r=>expect(r.Existing_2026_MW_scenario+r.Optimized_New_MW).toBeCloseTo(r.Total_2030_MW,5));
 });
 it('calibrates ROR and PROR annual factors with correct day weights',()=>{
  expect(days).toBe(365);
  expect(ROR_CF).toBeCloseTo(83633*1000/(14869*8760),11);
  expect(PROR_CF).toBeCloseTo(63494*1000/(12831*8760),11);
  expect(weighted('ror_avail')).toBeCloseTo(ROR_CF,11);
  expect(weighted('pror_inflow')).toBeCloseTo(PROR_CF,11);
  expect(monthlyCalibration2030[1].ror_avail).toBeLessThan(monthlyCalibration2030[7].ror_avail);
 });
 it('has a 17% solar annual availability and conservative existing reservoir energy',()=>{
  expect(weighted('solar_mean')).toBeCloseTo(.17,11);
  expect(monthlyCalibration2030.reduce((s,r)=>s+r.existing_storage_mwh,0)).toBeCloseTo(92362.28,2);
  expect(monthlyCalibration2030.reduce((s,r)=>s+r.new_storage_mwh_per_mw,0))
   .toBeCloseTo(STORAGE_CF*8760,8);
 });
});
