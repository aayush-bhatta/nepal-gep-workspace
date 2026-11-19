import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('https://fixture.supabase.co/**',route=>{
  if(route.request().method()==='GET')return route.fulfill({status:200,json:[]});
  return route.fulfill({status:200,json:{}});
 });
 await page.goto('/nepal-gep-workspace/#/study-2030');
 await expect(page.getByRole('heading',{name:'How the 2030 generation mix was obtained'})).toBeVisible();
});

test('distinguishes existing 2026 capacity, new investment and total 2030',async({page})=>{
 const row=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'ROR',exact:true})}).first();
 await expect(row).toContainText('2,950.47');
 await expect(row).toContainText('271.34');
 await expect(row).toContainText('3,221.81');
 await expect(page.getByRole('heading',{name:/Installed capacity in 2030/})).toBeVisible();
 await expect(page.getByText('Modelled existing 2026')).toBeVisible();
 await expect(page.getByText('New MW chosen for 2030')).toBeVisible();
});

test('has source-to-model calculations and actual LP equations accessible without login',async({page})=>{
 await page.getByRole('button',{name:'Evidence & calibration',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hydrology and solar: coefficients, not observed time series'})).toBeVisible();
 await expect(page.getByText('CF_ROR =', {exact:false}).first()).toBeVisible();
 await expect(page.getByText('PROR water-inflow coefficient')).toBeVisible();
 await page.getByRole('button',{name:'LP equations',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Least-cost generation expansion: what was optimised'})).toBeVisible();
 await expect(page.getByText('PROR power and short-term water')).toBeVisible();
 await expect(page.getByText('New seasonal reservoir')).toBeVisible();
 await expect(page.getByText('Dry-peak adequacy screen')).toBeVisible();
});

test('monthly coefficient CSV and wet/dry charts remain usable',async({page})=>{
 await page.getByRole('button',{name:'Dispatch',exact:true}).click();
 await page.getByRole('button',{name:'August · wet',exact:true}).click();
 await expect(page.getByText('August (wet-season representative day)')).toBeVisible();
 await page.getByRole('button',{name:'February · dry',exact:true}).click();
 await expect(page.getByText('February (dry-season representative day)')).toBeVisible();
 const requested=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download calibration CSV'}).click();
 expect((await requested).suggestedFilename()).toBe('2030_monthly_source_to_model_coefficients.csv');
});
