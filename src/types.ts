export const horizons=[2030,2040,2050] as const;
export const categories=['Hourly demand','ROR hydrology','PROR hydrology','Storage hydro','Solar PV profiles','BESS assumptions','Technology costs','Reliability constraints','Reserve margin','Imports / exports','Policy constraints'];
export const inputStatuses=['Missing','Tentative','Under review','Verified'];
export const taskStatuses=['Not started','In progress','Blocked','Under review','Complete'];
export const runStatuses=['Not run','Running','Completed, unverified','Under review','Verified','Failed / infeasible'];
export type Row={id:string;[k:string]:any};
export const folders=['Data/Demand','Data/Hydrology','Data/Solar','Data/Costs','Models/Python scripts','Models/Model versions','Results/2030','Results/2040','Results/2050','Reports/Word','Reports/PDF','Reports/Figures','Reports/Tables'];
