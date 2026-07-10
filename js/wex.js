// ═══════════════════════════════════════════════════════
// wex.js — Work Experience Quantities v4
// ═══════════════════════════════════════════════════════

const WEX_ITEMS = [
  {key:'earthwork',    label:'Earth Work Excavation',     unit:'cum',group:'Earthwork'},
  {key:'conveyance',   label:'Conveyance Charges',        unit:'cum',group:'Earthwork'},
  {key:'wet_silt',     label:'Removal of Wet Silt',       unit:'cum',group:'Earthwork'},
  {key:'crusher_fill', label:'Filling with Crusher Dust', unit:'cum',group:'Earthwork'},
  {key:'gravel_fill',  label:'Gravel Filling',            unit:'cum',group:'Earthwork'},
  {key:'sand_fill',    label:'Sand Filling',              unit:'cum',group:'Earthwork'},
  {key:'bailing',      label:'Bailing Out of Water',      unit:'cum',group:'Earthwork'},
  {key:'cc_148',       label:'CC (1:4:8)',                unit:'cum',group:'Concrete'},
  {key:'vcc_136',      label:'VCC (1:3:6)',               unit:'cum',group:'Concrete'},
  {key:'m30_total',    label:'VRCC M30 (Total)',          unit:'cum',group:'Concrete'},
  {key:'m30_unr',      label:'Unreinforced M30',          unit:'cum',group:'Concrete'},
  {key:'m20_total',    label:'VCC M20 (Total)',           unit:'cum',group:'Concrete'},
  {key:'hysd_steel',   label:'HYSD Bar Reinforcement',    unit:'kg', group:'Steel'},
  {key:'drain_225',    label:'225mm (9") SW Drain',       unit:'rmt',group:'Drains'},
  {key:'drain_300',    label:"300mm (1'-0\") SW Drain",   unit:'rmt',group:'Drains'},
  {key:'dismantle_cc', label:'Dismantling CC Surface',    unit:'sqm',group:'Other'},
  {key:'dismantle_rcc',label:'Dismantling RCC Walls',     unit:'cum',group:'Other'},
  {key:'dismantle_rr', label:'Dismantling RR Masonry',    unit:'cum',group:'Other'},
  {key:'brick_masonry',label:'Brick Masonry',             unit:'cum',group:'Other'},
  {key:'brick_falg',   label:'Brick Masonry (FAL-G)',     unit:'cum',group:'Other'},
  {key:'plastering',   label:'Plastering (1:3) 12mm',     unit:'sqm',group:'Other'},
  {key:'grating_1200', label:'Gratings 1200mm',           unit:'nos',group:'Other'},
];
const WEX_BASE_GROUPS = ['Earthwork','Concrete','Steel','Drains','Other'];
const WEX_KEY = 'rsr_wex_data_v3';
const WEX_CTYPES_KEY = 'rsr_wex_custom_types';
const WEX_FYS = ['2017-18','2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25','2025-26'];
const WEX_SEED=[{"genCode": "2023-ENG05-48-148", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 12.46, "dismantle_cc": 33.23, "dismantle_rcc": 1.35, "earthwork": 132.46, "conveyance": 177.0, "crusher_fill": 18.0, "bailing": 112.0, "cc_148": 15.94, "m30_total": 61.39, "hysd_steel": 3879.46, "gravel_fill": 74.48}, "workValue": 1590228.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023-ENG05-47-144", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 59.64, "earthwork": 44.73, "conveyance": 104.37, "crusher_fill": 14.91, "cc_148": 14.91, "hysd_steel": 4761.78}, "workValue": 724188.0, "workType": "RAFT/ WALL", "source": "import"}, {"genCode": "2023-ENG05-48-141", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 21.28, "dismantle_cc": 38.86, "dismantle_rr": 48.34, "earthwork": 78.21, "conveyance": 186.7, "crusher_fill": 17.94, "cc_148": 17.94, "m30_total": 46.89, "m20_total": 4.8, "hysd_steel": 4873.73, "gravel_fill": 58.24}, "workValue": 1616528.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023-ENG05-48-120", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"earthwork": 380.15, "conveyance": 380.15, "crusher_fill": 14.09, "cc_148": 14.09, "m30_total": 143.6, "hysd_steel": 8234.54, "gravel_fill": 126.9, "sand_fill": 400.0}, "workValue": 3934154.0, "workType": "WALL/CC DRAINS", "source": "import"}, {"genCode": "2023-ENG05-43-110", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 139.31, "dismantle_rcc": 47.77, "dismantle_rr": 4.06, "earthwork": 138.48, "conveyance": 392.62, "crusher_fill": 19.29, "bailing": 96.0, "cc_148": 19.29, "m30_total": 103.2, "hysd_steel": 8290.29, "gravel_fill": 54.68}, "workValue": 2747616.0, "workType": "CULVERT/ROAD", "source": "import"}, {"genCode": "2023-ENG05-46-154", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 3.38, "dismantle_cc": 13.46, "earthwork": 94.22, "conveyance": 111.06, "crusher_fill": 50.75, "m30_unr": 102.74, "m20_total": 50.57, "drain_225": 44.2, "drain_300": 75.05}, "workValue": 1653333.0, "workType": "CC ROADS/CC DRAINS", "source": "import"}, {"genCode": "2023-ENG05-43-121", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 148.8, "dismantle_rcc": 20.21, "earthwork": 81.51, "conveyance": 250.52, "crusher_fill": 27.18, "cc_148": 27.18}, "workValue": 370298.0, "workType": "GEDDA RAFT/WALLS", "source": "import"}, {"genCode": "2023-ENG05-46-155", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 7.25, "dismantle_cc": 28.9, "earthwork": 85.05, "conveyance": 121.2, "crusher_fill": 42.53, "m30_total": 89.13, "m30_unr": 89.13, "m20_total": 42.53, "drain_225": 104.85, "drain_300": 107.55}, "workValue": 1648383.0, "workType": "CC ROAD/DRAINS", "source": "import"}, {"genCode": "2023-ENG05-48-105", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 2.49, "dismantle_cc": 21.84, "dismantle_rr": 30.33, "earthwork": 67.42, "conveyance": 122.08, "crusher_fill": 24.78, "bailing": 60.0, "cc_148": 24.78, "m30_total": 47.06, "m30_unr": 7.92, "hysd_steel": 2843.07, "drain_225": 113.8}, "workValue": 1608606.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023-ENG05-51-146", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"crusher_fill": 59.47, "m30_unr": 126.34}, "workValue": 1221176.0, "workType": "CC ROAD/DRAINS", "source": "import"}, {"genCode": "2023-ENG05-46-165", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"earthwork": 47.07, "crusher_fill": 10.5, "bailing": 96.0, "cc_148": 10.5, "m30_total": 44.52, "m20_total": 3.51, "hysd_steel": 3462.2, "grating_1200": 8.0}, "workValue": 1586365.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023-ENG05-46-145", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 5.37, "dismantle_cc": 18.764, "dismantle_rr": 3.35, "earthwork": 37.03, "conveyance": 65.18, "crusher_fill": 14.91, "bailing": 96.0, "m30_total": 30.27, "m30_unr": 86.21, "m20_total": 8.68, "hysd_steel": 2634.66}, "workValue": 1527872.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023-ENG05-48-106", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 6.36, "dismantle_cc": 10.72, "dismantle_rr": 58.49, "earthwork": 103.69, "conveyance": 103.69, "crusher_fill": 21.79, "bailing": 80.0, "cc_148": 21.79, "vcc_136": 6.53, "m30_total": 48.62, "hysd_steel": 3772.24, "plastering": 117.89}, "workValue": 1601460.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023ENG-05-46-163", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"earthwork": 31.5, "crusher_fill": 10.5, "bailing": 96.0, "cc_148": 10.5, "m30_total": 47.39, "m20_total": 1.4, "hysd_steel": 3192.75, "grating_1200": 8.0}, "workValue": 1568482.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023ENG05-46-149", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"conveyance": 9.41, "m30_total": 0.63, "hysd_steel": 136.8, "brick_masonry": 8.06}, "workValue": 1616317.0, "workType": "KALYANAMANDAPAM", "source": "import"}, {"genCode": "2023-ENG05-46-156", "firm": "RSR Constructions", "fy": "2023-24", "quantities": {"wet_silt": 2.9, "dismantle_cc": 11.53, "earthwork": 91.35, "conveyance": 105.78, "crusher_fill": 45.57, "m30_unr": 109.97, "m20_total": 44.24, "drain_225": 82.05, "drain_300": 22.6}, "workValue": null, "workType": null, "source": "import"}, {"genCode": "2023-ENG05-47-144", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"bailing": 16.0, "m30_total": 60.07, "m20_total": 1.43, "hysd_steel": 342.1, "gravel_fill": 11.92}, "workValue": 872668.0, "workType": "RAFT/WALL", "source": "import"}, {"genCode": "2023-ENG05-43-121", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"bailing": 60.0, "m30_total": 57.53, "hysd_steel": 4193.25, "gravel_fill": 15.56}, "workValue": 1078697.0, "workType": "GEDDA RAFT/WALLS", "source": "import"}, {"genCode": "2023-ENG05-46-162", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"earthwork": 34.65, "crusher_fill": 12.65, "bailing": 90.0, "cc_148": 15.68, "m30_total": 46.55, "m20_total": 6.6, "hysd_steel": 4671.7, "gravel_fill": 28.05}, "workValue": 1602936.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023-ENG05-47-139", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"wet_silt": 23.33, "dismantle_cc": 11.78, "dismantle_rcc": 14.3, "dismantle_rr": 33.46, "earthwork": 55.07, "conveyance": 137.94, "crusher_fill": 17.41, "bailing": 24.0, "cc_148": 17.41, "m30_total": 52.88, "hysd_steel": 3286.25}, "workValue": 1565235.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023ENG05-46-159", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"earthwork": 34.4, "crusher_fill": 12.56, "bailing": 90.0, "cc_148": 14.74, "m30_total": 45.25, "m20_total": 6.55, "hysd_steel": 4731.61, "gravel_fill": 25.15}, "workValue": 1586621.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023ENG-05-46-166", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"earthwork": 52.2, "crusher_fill": 13.05, "bailing": 96.0, "cc_148": 13.05, "m30_total": 55.33, "m20_total": 1.74, "hysd_steel": 4313.21}, "workValue": 1599021.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023ENG05-46-164", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"earthwork": 31.5, "crusher_fill": 11.5, "bailing": 90.0, "cc_148": 14.25, "m30_total": 46.9, "m20_total": 6.0, "hysd_steel": 4521.8, "gravel_fill": 25.5}, "workValue": 1595541.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2023ENG05-46-147", "firm": "RSR Constructions", "fy": "2024-25", "quantities": {"earthwork": 117.44, "crusher_fill": 7.34, "cc_148": 11.01, "m30_total": 66.06, "hysd_steel": 3465.49, "gravel_fill": 42.94}, "workValue": 1545197.0, "workType": "RETAINING WALL", "source": "import"}, {"genCode": "2016-ENG01-04-212", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"earthwork": 106.0, "crusher_fill": 104.0, "m30_unr": 107.0, "gravel_fill": 32.0}, "workValue": 777291.0, "workType": "CC ROAD", "source": "import"}, {"genCode": "2017-ENG07-99-334", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"dismantle_rcc": 24.66, "earthwork": 94.82, "crusher_fill": 15.0, "cc_148": 43.66, "m30_unr": 100.0, "drain_300": 138.5}, "workValue": 1353646.0, "workType": "CC ROAD & cc drains", "source": "import"}, {"genCode": "2017-ENG03-26-115", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"wet_silt": 100.28, "dismantle_rcc": 33.79, "dismantle_rr": 12.43, "earthwork": 45.3, "crusher_fill": 79.0, "bailing": 440.29, "vcc_136": 64.53, "m30_total": 18.46, "m30_unr": 28.07, "hysd_steel": 2007.5, "drain_225": 109.4, "drain_300": 69.0, "plastering": 376.0}, "workValue": 1689063.0, "workType": "SW DRAIN", "source": "import"}, {"genCode": "2017-ENG07-99-157", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"dismantle_rcc": 2.68, "dismantle_rr": 3.63, "earthwork": 0.24, "cc_148": 0.2, "vcc_136": 1.28, "m30_total": 0.14, "hysd_steel": 18.18, "drain_300": 28.7, "plastering": 8.0, "brick_falg": 3.63}, "workValue": 308090.0, "workType": "CC ROAD & cc drains", "source": "import"}, {"genCode": "2017-ENG07-99-220", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"earthwork": 99.93, "crusher_fill": 25.01, "cc_148": 37.54, "m30_total": 0.22, "m30_unr": 71.13, "m20_total": 0.16, "hysd_steel": 37.68, "drain_300": 280.8, "gravel_fill": 50.04}, "workValue": 873247.0, "workType": "CC ROAD & cc drains", "source": "import"}, {"genCode": "2016-ENG07-99-334", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"dismantle_rcc": 1.89, "earthwork": 73.79, "conveyance": 75.62, "crusher_fill": 73.32, "vcc_136": 0.29, "m30_total": 0.17, "m30_unr": 132.88, "hysd_steel": 16.59, "drain_300": 52.8, "plastering": 2.34}, "workValue": 994270.0, "workType": "CC ROAD & cc drains", "source": "import"}, {"genCode": "2017-ENG01-06-149", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"earthwork": 96.0, "crusher_fill": 11.4, "cc_148": 11.4, "m30_total": 19.54, "hysd_steel": 5450.0}, "workValue": 498345.61, "workType": "retaining wall", "source": "import"}, {"genCode": "2017-ENG03-21-100", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"earthwork": 193.36}, "workValue": 128524.55, "workType": "box culvert", "source": "import"}, {"genCode": "2017-ENG07-99-277", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"dismantle_rr": 4.46}, "workValue": 1444.81, "workType": "cc road", "source": "import"}, {"genCode": "2017-ENG07-99-276", "firm": "R Sadhu Rao", "fy": "2017-18", "quantities": {"dismantle_rr": 1.47}, "workValue": 474.68, "workType": "cc road", "source": "import"}, {"genCode": "2017-ENG01-06-149", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"bailing": 400.0, "m30_total": 74.7}, "workValue": 859472.36, "workType": "retaining wall", "source": "import"}, {"genCode": "2015-ENG03-21-100", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"wet_silt": 23.76, "dismantle_cc": 5.78, "dismantle_rr": 9.71, "earthwork": 427.39, "conveyance": 563.05, "crusher_fill": 97.96, "vcc_136": 21.86, "m30_total": 27.82, "m30_unr": 7.48, "m20_total": 17.57, "hysd_steel": 3617.14, "brick_falg": 11.65}, "workValue": 1452124.05, "workType": "box culvert", "source": "import"}, {"genCode": "2018-ENG01-04-144", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"earthwork": 75.07}, "workValue": 2034656.7, "workType": "cc drains &rcc culvert", "source": "import"}, {"genCode": "2017-ENG07-99-277", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"crusher_fill": 24.56, "m30_unr": 73.1}, "workValue": 490758.93, "workType": "cc road", "source": "import"}, {"genCode": "2018-ENG01-05-131", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"earthwork": 122.51, "cc_148": 25.2}, "workValue": 367535.0, "workType": "cc drains& culvert", "source": "import"}, {"genCode": "2018-ENG01-05-141", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"earthwork": 411.41, "cc_148": 53.58, "m20_total": 60.36}, "workValue": 715630.18, "workType": "cc drains& culvert", "source": "import"}, {"genCode": "2018-ENG03-29-120", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"earthwork": 355.2, "crusher_fill": 44.4, "cc_148": 24.03, "vcc_136": 3.32, "m30_total": 71.61, "hysd_steel": 5397.61}, "workValue": 1398132.69, "workType": "STORE ROOM & toilets", "source": "import"}, {"genCode": "2017-ENG03-21-105", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"dismantle_cc": 27.63, "dismantle_rcc": 7.0, "earthwork": 19.32, "vcc_136": 27.16, "m30_unr": 167.04}, "workValue": 1627606.18, "workType": "cc roads and drains", "source": "import"}, {"genCode": "2018-ENG07-99-235", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"dismantle_rcc": 9.21, "earthwork": 458.16, "conveyance": 467.37, "cc_148": 56.2, "vcc_136": 13.73, "m30_total": 1.98, "m30_unr": 271.0, "hysd_steel": 159.44, "drain_300": 487.4}, "workValue": 2744191.0, "workType": "cc roads and cc drains", "source": "import"}, {"genCode": "2018-ENG-08-99-133", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"earthwork": 270.78, "crusher_fill": 72.81, "vcc_136": 333.97, "m30_total": 3.98, "m30_unr": 54.06, "hysd_steel": 469.58}, "workValue": 1281365.0, "workType": "cc roads and cc drains", "source": "import"}, {"genCode": "2017-ENG07-99-449", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"dismantle_rcc": 12.82, "earthwork": 159.94, "conveyance": 172.76, "crusher_fill": 93.1, "cc_148": 2.66, "vcc_136": 7.69, "m30_total": 1.87, "m30_unr": 251.81, "m20_total": 0.5, "hysd_steel": 102.72}, "workValue": 1534085.0, "workType": "cc roads &rcc culvert", "source": "import"}, {"genCode": "2018-ENG-01-06-105", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"earthwork": 921.74, "crusher_fill": 135.97, "cc_148": 132.19, "vcc_136": 92.2, "m30_total": 200.59, "m20_total": 5.8, "hysd_steel": 9753.23}, "workValue": 3844471.0, "workType": "sw drain", "source": "import"}, {"genCode": "2017-ENG07-99-454", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"dismantle_rcc": 45.0, "dismantle_rr": 15.07, "earthwork": 62.72, "conveyance": 108.89, "crusher_fill": 76.38, "vcc_136": 1.32, "m30_total": 1.68, "m30_unr": 151.42, "hysd_steel": 139.02, "drain_225": 60.0, "drain_300": 185.0}, "workValue": 1284612.0, "workType": "cc road cc drains &rcc culvert", "source": "import"}, {"genCode": "2017-ENG07-99-465", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"wet_silt": 11.94, "dismantle_rcc": 47.79, "dismantle_rr": 30.72, "earthwork": 303.96, "conveyance": 382.61, "crusher_fill": 212.24, "cc_148": 28.25, "m30_unr": 267.7, "m20_total": 4.16, "hysd_steel": 40.92, "drain_225": 317.8, "drain_300": 12.0}, "workValue": 2484339.0, "workType": "cc road cc drains &rcc culvert", "source": "import"}, {"genCode": "2017-ENG03-23-120", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"crusher_fill": 4.85, "m30_total": 18.297, "m30_unr": 2.896, "m20_total": 4.657, "hysd_steel": 2419.94, "drain_300": 15.4}, "workValue": 407088.85, "workType": "vrcc cover slabes cover slabes", "source": "import"}, {"genCode": "2017-ENG07-99-263", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"dismantle_rcc": 16.81, "dismantle_rr": 17.8, "earthwork": 111.59, "conveyance": 146.0, "crusher_fill": 79.25, "bailing": 170.0, "cc_148": 61.6, "vcc_136": 4.35, "m30_total": 1.23, "m30_unr": 115.66, "m20_total": 1.0, "hysd_steel": 77.39, "drain_300": 186.7}, "workValue": 1340520.0, "workType": "cc road & cc drains", "source": "import"}, {"genCode": "2017-ENG-03-27-162", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"wet_silt": 30.03, "dismantle_cc": 6.0, "dismantle_rcc": 1.0, "cc_148": 36.0, "m30_unr": 107.86, "drain_300": 142.1}, "workValue": 935843.37, "workType": "cc intrnal road", "source": "import"}, {"genCode": "2027-ENG05-57-166", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"dismantle_cc": 70.72, "dismantle_rcc": 9.0, "dismantle_rr": 34.77, "conveyance": 114.5, "m30_unr": 96.35, "m20_total": 2.12, "hysd_steel": 294.54, "drain_300": 430.1}, "workValue": 1134016.0, "workType": "cc roads &drains", "source": "import"}, {"genCode": "2018-ENG01-06-126", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"earthwork": 424.67, "crusher_fill": 46.0, "cc_148": 46.0, "hysd_steel": 13116.0}, "workValue": 1375054.03, "workType": "RCC DRAINS & RCC CULVERTS", "source": "import"}, {"genCode": "2017-ENG07-99-276", "firm": "R Sadhu Rao", "fy": "2018-19", "quantities": {"crusher_fill": 28.69, "m30_unr": 73.2}, "workValue": 493883.0, "workType": "CC ROAD", "source": "import"}, {"genCode": "2017-ENG03-23-117", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"wet_silt": 10.92, "dismantle_rcc": 4.13, "crusher_fill": 27.75, "m30_total": 19.3, "m20_total": 8.31, "hysd_steel": 2406.99}, "workValue": 429947.61, "workType": "vrcc platform for dumper bins", "source": "import"}, {"genCode": "2019-ENG01-05-122", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"dismantle_cc": 16.09, "dismantle_rr": 126.1, "earthwork": 90.56, "cc_148": 10.83, "vcc_136": 9.27, "m30_total": 24.59, "m20_total": 11.71, "hysd_steel": 2536.15, "drain_300": 799.8, "plastering": 80.64}, "workValue": 1439982.82, "workType": "cc drains & culvert", "source": "import"}, {"genCode": "2017-ENG08-99-219", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"earthwork": 167.64, "crusher_fill": 151.1, "cc_148": 0.86, "vcc_136": 1.1, "m30_total": 2.69, "m30_unr": 216.69, "hysd_steel": 147.09, "plastering": 64.92, "brick_falg": 6.5, "gravel_fill": 37.41}, "workValue": 1576215.0, "workType": "road &shelters", "source": "import"}, {"genCode": "2018-ENG03-29-120", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"crusher_fill": 35.15, "cc_148": 7.81, "vcc_136": 0.72, "m30_total": 94.15, "hysd_steel": 5489.16, "plastering": 1143.37, "brick_falg": 112.27}, "workValue": 2345013.62, "workType": "store room toilets", "source": "import"}, {"genCode": "2018-ENG01-04-140", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"earthwork": 150.38, "crusher_fill": 7.0, "cc_148": 7.0, "m20_total": 123.09, "hysd_steel": 6172.68}, "workValue": 1320327.79, "workType": "CC DRAINS&RCC CULVERT", "source": "import"}, {"genCode": "2018-ENG01-06-126", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"m20_total": 261.0, "hysd_steel": 13116.14}, "workValue": 2201410.77, "workType": "rccd drains and rcc culverts", "source": "import"}, {"genCode": "2018-ENG01-04-144", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"crusher_fill": 5.86, "cc_148": 7.0, "m20_total": 30.12, "hysd_steel": 2758.0}, "workValue": 629881.65, "workType": "LAYING OF INTERNAL CC ROADS", "source": "import"}, {"genCode": "2018-ENG01-05-141", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"m20_total": 14.3, "hysd_steel": 8412.25}, "workValue": 1916684.07, "workType": "laying of cc drains &culverts", "source": "import"}, {"genCode": "2018-ENG01-06-127", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"earthwork": 66.0, "crusher_fill": 7.0, "cc_148": 7.0, "vcc_136": 70.39, "m20_total": 39.79, "hysd_steel": 2747.69}, "workValue": 642501.78, "workType": "LAYING OF INTERNAL CC ROADS", "source": "import"}, {"genCode": "2018-ENG01-06-125", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"earthwork": 53.0, "crusher_fill": 5.0, "cc_148": 12.12, "hysd_steel": 2108.9}, "workValue": 543430.07, "workType": "laying of cc drains &culverts", "source": "import"}, {"genCode": "2018-ENG01-05-131", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"earthwork": 280.71, "cc_148": 28.42, "hysd_steel": 8504.0}, "workValue": 1992128.42, "workType": "CC DRAIN AND CULVERT", "source": "import"}, {"genCode": "2020-ENG06-71-102", "firm": "R Sadhu Rao", "fy": "2019-20", "quantities": {"dismantle_rcc": 6.93, "earthwork": 618.78, "crusher_fill": 91.51, "bailing": 560.0, "cc_148": 91.84, "m30_total": 4.84, "m20_total": 9.54, "hysd_steel": 16262.92, "plastering": 654.02}, "workValue": 3585940.0, "workType": "SW DRAIN", "source": "import"}];

// ─── HELPERS ─────────────────────────────────────────
async function loadWEXCustomTypes(){
  if(D.wexCustomTypes) return D.wexCustomTypes;
  try{
    const rows=await sbReq('settings?key=eq.'+WEX_CTYPES_KEY,'GET');
    if(rows&&rows.length&&rows[0].value) D.wexCustomTypes=JSON.parse(rows[0].value);
  }catch(e){}
  if(!D.wexCustomTypes) D.wexCustomTypes=[];
  return D.wexCustomTypes;
}
async function saveWEXCustomTypes(){
  await sbReq('settings','POST',{key:WEX_CTYPES_KEY,value:JSON.stringify(D.wexCustomTypes||[])});
}
async function loadWEXData(){
  if(D.wexData) return D.wexData;
  try{
    const rows=await sbReq('settings?key=eq.'+WEX_KEY,'GET');
    if(rows&&rows.length&&rows[0].value) D.wexData=JSON.parse(rows[0].value);
  }catch(e){}
  if(!D.wexData||!D.wexData.records){
    D.wexData={records:WEX_SEED.map(r=>({...r,id:'wex_'+uid()})),seeded:true};
    await saveWEXData().catch(()=>{});
  }
  return D.wexData;
}
async function saveWEXData(){
  await sbReq('settings','POST',{key:WEX_KEY,value:JSON.stringify(D.wexData)});
}
function getAllWEXItems(){
  const customs=(D.wexCustomTypes||[]).map(c=>({...c,isCustom:true}));
  return [...WEX_ITEMS,...customs];
}
function getAllWEXGroups(){
  const customGroups=[...new Set((D.wexCustomTypes||[]).map(c=>c.group||'Custom'))];
  const extra=customGroups.filter(g=>!WEX_BASE_GROUPS.includes(g));
  return [...WEX_BASE_GROUPS,...extra];
}
function getWEXEntries(p){
  if(!D.wexData) return [];
  const gc=(getGenCode(p)||'').toUpperCase();
  return (D.wexData.records||[])
    .filter(r=>r.genCode===gc||(r.projectId&&r.projectId===p.id))
    .sort((a,b)=>(a.fy||'').localeCompare(b.fy||''));
}
function getFYLabel(dateStr){
  if(!dateStr) return '2024-25';
  const d=new Date(dateStr),m=d.getMonth()+1,y=d.getFullYear();
  return m>=4?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;
}
function nextFY(fy){
  const parts=fy.split('-');
  if(parts.length!==2) return fy;
  const y=parseInt(parts[0])+1;
  return `${y}-${String(y+1).slice(2)}`;
}

// ─── PROJECT BANNER ───────────────────────────────────
function renderProjectWEXSection(p){
  if(!p.jvDate) return '';
  const entries=getWEXEntries(p);
  if(!entries.length){
    return `<div class="card" style="margin-bottom:14px;border-left:4px solid #7c3aed;background:#f5f3ff">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:#7c3aed">📐 Work Experience Quantities — Not Yet Entered</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">Enter quantities from the Work Experience Certificate once received.</div>
        </div>
        <button onclick="openWEXEntry('${p.id}',null)" style="background:#7c3aed;color:#fff;border:none;border-radius:var(--rs);padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">+ Enter Quantities</button>
      </div>
    </div>`;
  }
  const allItems=getAllWEXItems();
  const cards=entries.map(r=>`
    <div style="background:var(--surface2);border-radius:var(--rs);padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
        <div style="font-size:13px;font-weight:700;color:var(--navy)">FY ${r.fy}
          ${r.workValue?`<span style="font-size:11px;font-weight:400;color:var(--text3);margin-left:8px">Value: ${fmt(r.workValue)}</span>`:''}
          <span style="font-size:10px;background:${r.source==='import'?'#e8edf8':'#e8f5e9'};color:${r.source==='import'?'var(--navy)':'var(--green)'};padding:1px 7px;border-radius:8px;margin-left:6px">${r.source==='import'?'Imported':'Manual'}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="openWEXEntry('${p.id}','${r.id}')" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:4px 10px;font-size:11px;cursor:pointer;font-family:'Inter',sans-serif">✏️ Edit</button>
          <button onclick="deleteWEXEntry('${r.id}','${p.id}')" style="background:none;border:1px solid var(--red);border-radius:var(--rs);padding:4px 10px;font-size:11px;cursor:pointer;color:var(--red);font-family:'Inter',sans-serif">🗑️</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:6px">
        ${allItems.filter(item=>(r.quantities||{})[item.key]>0).map(item=>`
          <div style="padding:5px 8px;background:#fff;border-radius:6px${item.isCustom?';border:1px dashed #7c3aed':''}">
            <div style="font-size:10px;color:${item.isCustom?'#7c3aed':'var(--text3)'};text-transform:uppercase">${item.label}</div>
            <div style="font-size:12px;font-weight:700;color:var(--navy)">${r.quantities[item.key].toFixed(2)} <span style="font-weight:400;font-size:10px">${item.unit}</span></div>
          </div>`).join('')}
      </div>
    </div>`).join('');
  return `<div class="card" style="margin-bottom:14px;border-top:3px solid #7c3aed">
    <details data-toggle="wex-${p.id}" open>
      <summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px">
        <div class="st" style="margin:0;border:none;padding:0">📐 Work Experience (${entries.length} FY${entries.length>1?'s':''})</div>
        <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
      </summary>
      ${cards}
      <button onclick="openWEXEntry('${p.id}',null)" style="background:none;border:1px dashed #7c3aed;color:#7c3aed;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;width:100%;margin-top:4px">+ Add Another Financial Year</button>
    </details>
  </div>`;
}

// ─── ENTRY MODAL ──────────────────────────────────────
let _wexPid=null, _wexEditId=null;

async function openWEXEntry(pid,existingId){
  const p=GP(pid); if(!p) return;
  await loadWEXCustomTypes();
  _wexPid=pid; _wexEditId=existingId||null;
  const existing=existingId?(D.wexData.records||[]).find(r=>r.id===existingId):null;
  const usedFYs=getWEXEntries(p).map(r=>r.fy).filter(fy=>!existing||fy!==existing.fy);
  const fy1=existing?.fy||getFYLabel(p.jvDate)||'2024-25';
  const jvAmt=p.jvAmount||0;
  const wv1=existing?.workValue||jvAmt;
  let modal=document.getElementById('modal-wex-entry');
  if(!modal){modal=document.createElement('div');modal.className='mov';modal.id='modal-wex-entry';document.body.appendChild(modal);}
  _buildWEXModal(modal,p,existing,fy1,wv1,jvAmt,usedFYs);
  modal.classList.add('open');
}

function _buildWEXModal(modal,p,existing,fy1,wv1,jvAmt,usedFYs){
  const allItems=getAllWEXItems();
  const allGroups=getAllWEXGroups();
  const fy2=nextFY(fy1);
  const remaining=jvAmt>0?Math.max(0,jvAmt-wv1):0;
  const showFY2=remaining>100;
  const existing2=showFY2?(D.wexData?.records||[]).find(r=>
    (r.genCode===(getGenCode(p)||'').toUpperCase()||r.projectId===p.id)&&r.fy===fy2
  ):null;
  const fyOpts=(sel,disabled)=>WEX_FYS.map(y=>
    `<option value="${y}" ${(disabled||[]).includes(y)?'disabled':''} ${y===sel?'selected':''}>${y}${(disabled||[]).includes(y)?'✓':''}</option>`
  ).join('');

  // Build a quantity panel — same layout for both FY columns
  const qPanel=(suffix,existingRec,headerColor,fyLabel,wvLabel,fyOptHtml)=>{
    const isCustomHeader=suffix==='_2';
    const rows=allGroups.map(g=>{
      const items=allItems.filter(i=>i.group===g);
      if(!items.length) return '';
      return `<tr><td colspan="3" style="padding:10px 12px 4px;background:var(--surface2)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text3)">${g}</span>
          <div style="position:relative;display:inline-block">
            <button onclick="event.stopPropagation();toggleMenu('wex-grp-menu${suffix}-${g}')"
              style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:0 4px;line-height:1">⋮</button>
            <div class="amenu" id="wex-grp-menu${suffix}-${g}" style="right:0;top:100%">
              <button class="amenu-item" onclick="addWEXCustomToGroup('${g}','${suffix}')">+ Add custom item here</button>
            </div>
          </div>
        </div>
      </td></tr>
      ${items.map(item=>`<tr>
        <td style="padding:4px 12px;font-size:12px;color:var(--text2)">${item.label}${item.isCustom?'<span style="font-size:9px;color:#7c3aed;margin-left:4px">●</span>':''}</td>
        <td style="padding:4px 8px;font-size:11px;color:var(--text3);text-align:center;white-space:nowrap">${item.unit}</td>
        <td style="padding:4px 12px 4px 4px">
          <input type="number" step="0.001" min="0" id="wex${suffix}-${item.key}"
            value="${existingRec?.quantities?.[item.key]||''}" placeholder="—"
            style="width:90px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:'Inter',sans-serif;text-align:right">
        </td>
      </tr>`).join('')}`;
    }).join('');

    return `<div style="flex:1;min-width:340px">
      <div style="background:${headerColor};color:#fff;border-radius:var(--rs) var(--rs) 0 0;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">${isCustomHeader?'Financial Year 2':'Financial Year 1'}</div>
          <select id="wex-fy${suffix==='_2'?'2':'1'}" onchange="_wexFYChanged()"
            style="background:transparent;border:none;color:#fff;font-size:15px;font-weight:800;font-family:'Inter',sans-serif;cursor:pointer">
            ${fyOptHtml}
          </select>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;opacity:.7;margin-bottom:2px">${isCustomHeader?'Remaining (₹)':'Work Value (₹)'}</div>
          ${isCustomHeader
            ? `<div id="wex-remaining" style="font-size:15px;font-weight:800">${fmt(remaining)}</div>`
            : `<input type="number" id="wex-wv1" value="${wv1||''}" placeholder="${jvAmt||''}"
                oninput="_wexValueChanged()"
                style="background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.5);color:#fff;font-size:15px;font-weight:800;font-family:'Inter',sans-serif;width:130px;text-align:right">`
          }
        </div>
      </div>
      <div style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--rs) var(--rs);overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <colgroup><col style="width:55%"><col style="width:15%"><col style="width:30%"></colgroup>
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:6px 12px;font-size:10px;color:var(--text3);font-weight:600;text-align:left">Item</th>
            <th style="padding:6px 8px;font-size:10px;color:var(--text3);font-weight:600;text-align:center">Unit</th>
            <th style="padding:6px 12px;font-size:10px;color:var(--text3);font-weight:600;text-align:right">Qty</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  };

  const panel1=qPanel('',existing,'var(--navy)',fy1,wv1,fyOpts(fy1,usedFYs));
  const panel2=showFY2?qPanel('_2',existing2,'#7c3aed',fy2,'',fyOpts(fy2,usedFYs.filter(f=>f!==fy2))):'';

  modal.innerHTML=`<div class="mbox" style="max-width:${showFY2?'960px':'520px'};width:95vw;max-height:90vh;display:flex;flex-direction:column">
    <div class="mhdr" style="flex-shrink:0">
      <h2>📐 ${_wexEditId?'Edit':'Add'} Work Experience Quantities</h2>
      <button class="mx" onclick="CM('modal-wex-entry')">✕</button>
    </div>
    <div style="background:var(--surface2);border-radius:var(--rs);padding:8px 14px;margin-bottom:14px;font-size:12px;color:var(--text2);flex-shrink:0">
      <strong>${p.name.substring(0,65)}</strong>&nbsp;·&nbsp;Gen Code: <strong>${getGenCode(p)||'—'}</strong>&nbsp;·&nbsp;Firm: ${p.firm||'RSR Constructions'}${jvAmt?`&nbsp;·&nbsp;JV: <strong>${fmt(jvAmt)}</strong>`:''}
    </div>
    <div id="wex-panels" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;overflow-y:auto;flex:1;padding-bottom:4px">
      ${panel1}
      <div id="wex-panel2" style="${showFY2?'flex:1;min-width:340px':'display:none'}">${panel2.replace(/<div style="flex:1;min-width:340px">/,'<div>') }</div>
    </div>
    <!-- Global custom types -->
    <div style="flex-shrink:0;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Global Custom Quantity Types</div>
        <button onclick="addWEXGlobalCustomType()" style="background:none;border:1px dashed #7c3aed;color:#7c3aed;border-radius:var(--rs);padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">+ Add New Type</button>
      </div>
      <div id="wex-custom-types-list">${_renderWEXCustomTypesList()}</div>
    </div>
    <div style="flex-shrink:0;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:12px;margin-top:12px">
      <button class="btn" onclick="CM('modal-wex-entry')">Cancel</button>
      <button class="btn btn-navy" onclick="saveWEXEntry()">✓ Save Quantities</button>
    </div>
  </div>`;
}

function _renderWEXCustomTypesList(){
  const types=D.wexCustomTypes||[];
  if(!types.length) return '<div style="font-size:12px;color:var(--text3);font-style:italic">No custom types yet. Use ⋮ beside any group to add a custom item there, or click "+ Add New Type" above.</div>';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px">${
    types.map((ct,i)=>`<div style="display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border-radius:8px;padding:3px 10px;border:1px dashed #7c3aed">
      <span style="font-size:12px;color:var(--navy);font-weight:600">${ct.label}</span>
      <span style="font-size:10px;color:var(--text3)">(${ct.unit})</span>
      <button onclick="_removeWEXCustomType(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:0 2px">✕</button>
    </div>`).join('')
  }</div>`;
}

function _wexValueChanged(){
  const p=GP(_wexPid); if(!p) return;
  const wv1=parseFloat(document.getElementById('wex-wv1')?.value)||0;
  const jvAmt=p.jvAmount||0;
  const remaining=jvAmt>0?Math.max(0,jvAmt-wv1):0;
  const remEl=document.getElementById('wex-remaining');
  if(remEl) remEl.textContent=fmt(remaining);
  const panel2=document.getElementById('wex-panel2');
  const mbox=panel2?.closest('.mbox');
  if(panel2){
    if(remaining>100&&panel2.style.display==='none'){
      // Build FY2 panel content
      const fy1=document.getElementById('wex-fy1')?.value||getFYLabel(p.jvDate);
      const fy2=nextFY(fy1);
      const usedFYs=getWEXEntries(p).map(r=>r.fy);
      const allItems=getAllWEXItems(); const allGroups=getAllWEXGroups();
      const existing2=(D.wexData?.records||[]).find(r=>(r.genCode===(getGenCode(p)||'').toUpperCase()||r.projectId===p.id)&&r.fy===fy2);
      const rows=allGroups.map(g=>{
        const items=allItems.filter(i=>i.group===g); if(!items.length) return '';
        return `<tr><td colspan="3" style="padding:10px 12px 4px;background:var(--surface2)">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text3)">${g}</span>
            <div style="position:relative;display:inline-block">
              <button onclick="event.stopPropagation();toggleMenu('wex-grp-menu_2-${g}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:0 4px">⋮</button>
              <div class="amenu" id="wex-grp-menu_2-${g}" style="right:0;top:100%">
                <button class="amenu-item" onclick="addWEXCustomToGroup('${g}','_2')">+ Add custom item here</button>
              </div>
            </div>
          </div>
        </td></tr>
        ${items.map(item=>`<tr>
          <td style="padding:4px 12px;font-size:12px;color:var(--text2)">${item.label}${item.isCustom?'<span style="font-size:9px;color:#7c3aed;margin-left:4px">●</span>':''}</td>
          <td style="padding:4px 8px;font-size:11px;color:var(--text3);text-align:center">${item.unit}</td>
          <td style="padding:4px 12px 4px 4px"><input type="number" step="0.001" min="0" id="wex_2-${item.key}"
            value="${existing2?.quantities?.[item.key]||''}" placeholder="—"
            style="width:90px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:'Inter',sans-serif;text-align:right"></td>
        </tr>`).join('')}`;
      }).join('');
      panel2.innerHTML=`<div style="background:#7c3aed;color:#fff;border-radius:var(--rs) var(--rs) 0 0;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div><div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Financial Year 2</div>
          <select id="wex-fy2" style="background:transparent;border:none;color:#fff;font-size:15px;font-weight:800;font-family:'Inter',sans-serif;cursor:pointer">
            ${WEX_FYS.map(y=>`<option value="${y}" ${y===fy2?'selected':''}>${y}</option>`).join('')}
          </select>
        </div>
        <div style="text-align:right"><div style="font-size:10px;opacity:.7;margin-bottom:2px">Remaining (₹)</div>
          <div id="wex-remaining" style="font-size:15px;font-weight:800">${fmt(remaining)}</div>
        </div>
      </div>
      <div style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--rs) var(--rs);overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <colgroup><col style="width:55%"><col style="width:15%"><col style="width:30%"></colgroup>
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:6px 12px;font-size:10px;color:var(--text3);font-weight:600;text-align:left">Item</th>
            <th style="padding:6px 8px;font-size:10px;color:var(--text3);font-weight:600;text-align:center">Unit</th>
            <th style="padding:6px 12px;font-size:10px;color:var(--text3);font-weight:600;text-align:right">Qty</th>
          </tr></thead><tbody>${rows}</tbody>
        </table>
      </div>`;
      panel2.style.cssText='flex:1;min-width:340px';
      if(mbox) mbox.style.maxWidth='960px';
    } else if(remaining<=100&&panel2.style.display!=='none'&&panel2.style.cssText.includes('flex')){
      panel2.style.display='none';
      if(mbox) mbox.style.maxWidth='520px';
    }
  }
}

function _wexFYChanged(){
  const fy1=document.getElementById('wex-fy1')?.value; if(!fy1) return;
  const fy2sel=document.getElementById('wex-fy2'); if(fy2sel) fy2sel.value=nextFY(fy1);
}

// ─── ADD CUSTOM TYPE ─────────────────────────────────
function addWEXCustomToGroup(group,suffix){
  const label=prompt(`Add custom item to "${group}" section:\nItem name (e.g. "Pre-cast Slabs"):`)?.trim();
  if(!label) return;
  const unit=prompt('Unit (e.g. nos, sqm, rmt, cum, kg):')?.trim()||'nos';
  _addWEXCustomItem(label,unit,group,suffix);
}

function addWEXGlobalCustomType(){
  const label=prompt('Custom quantity type name (e.g. "4×4 Tiles"):')?.trim();
  if(!label) return;
  const unit=prompt('Unit (e.g. sqm, nos, rmt, cum, kg):')?.trim()||'nos';
  _addWEXCustomItem(label,unit,'Custom','');
}

function _addWEXCustomItem(label,unit,group,suffix){
  if(!D.wexCustomTypes) D.wexCustomTypes=[];
  const key='custom_'+label.replace(/[^a-z0-9]/gi,'_').toLowerCase()+'_'+Date.now().toString(36);
  D.wexCustomTypes.push({key,label,unit,group:group||'Custom',isCustom:true});
  saveWEXCustomTypes().catch(()=>{});
  // Refresh custom types list
  const el=document.getElementById('wex-custom-types-list');
  if(el) el.innerHTML=_renderWEXCustomTypesList();
  // Rebuild modal so the new item appears in the quantity tables
  const p=GP(_wexPid); if(!p) return;
  const existing=_wexEditId?(D.wexData.records||[]).find(r=>r.id===_wexEditId):null;
  const fy1=document.getElementById('wex-fy1')?.value||getFYLabel(p.jvDate);
  const wv1=parseFloat(document.getElementById('wex-wv1')?.value)||0;
  const jvAmt=p.jvAmount||0;
  const usedFYs=getWEXEntries(p).map(r=>r.fy).filter(fy=>!existing||fy!==existing?.fy);
  const modal=document.getElementById('modal-wex-entry');
  if(modal) _buildWEXModal(modal,p,existing,fy1,wv1,jvAmt,usedFYs);
}

async function _removeWEXCustomType(idx){
  if(!D.wexCustomTypes||!D.wexCustomTypes[idx]) return;
  const ct=D.wexCustomTypes[idx];
  if(!confirm(`Remove "${ct.label}" from all future entries?\n(Existing saved data is not deleted.)`)) return;
  D.wexCustomTypes.splice(idx,1);
  await saveWEXCustomTypes();
  const el=document.getElementById('wex-custom-types-list');
  if(el) el.innerHTML=_renderWEXCustomTypesList();
}

// ─── SAVE ─────────────────────────────────────────────
async function saveWEXEntry(){
  const p=GP(_wexPid); if(!p) return;
  const allItems=getAllWEXItems();
  const fy1=document.getElementById('wex-fy1')?.value;
  if(!fy1){toast('Select financial year','error');return;}
  const wv1=parseFloat(document.getElementById('wex-wv1')?.value)||0;
  const q1={};
  allItems.forEach(item=>{
    const v=parseFloat(document.getElementById('wex-'+item.key)?.value)||0;
    if(v>0) q1[item.key]=Math.round(v*1000)/1000;
  });
  const panel2=document.getElementById('wex-panel2');
  const hasFY2=panel2&&panel2.style.cssText&&panel2.style.cssText.includes('flex')&&panel2.style.display!=='none';
  const fy2=hasFY2?document.getElementById('wex-fy2')?.value:null;
  const q2={};
  if(hasFY2) allItems.forEach(item=>{
    const v=parseFloat(document.getElementById('wex_2-'+item.key)?.value)||0;
    if(v>0) q2[item.key]=Math.round(v*1000)/1000;
  });
  const hasQ1=Object.keys(q1).length>0, hasQ2=hasFY2&&Object.keys(q2).length>0;
  if(!hasQ1&&!hasQ2){toast('Enter at least one quantity','error');return;}
  if(!D.wexData) D.wexData={records:[]};
  const gc=(getGenCode(p)||'').toUpperCase(), now=new Date().toISOString();
  const mkRec=(fy,qtys,wv,eid)=>({id:eid||'wex_'+uid(),genCode:gc,projectId:p.id,firm:p.firm||'RSR Constructions',fy,quantities:qtys,workValue:wv,source:'manual',updatedAt:now});
  if(hasQ1){
    const rec=mkRec(fy1,q1,wv1,_wexEditId);
    const idx=D.wexData.records.findIndex(r=>r.id===_wexEditId);
    if(idx>=0) D.wexData.records[idx]=rec; else D.wexData.records.push(rec);
  }
  if(hasFY2&&hasQ2&&fy2){
    const jvAmt=p.jvAmount||0;
    const wv2=Math.max(0,jvAmt-wv1);
    const ex2=D.wexData.records.find(r=>(r.genCode===gc||r.projectId===p.id)&&r.fy===fy2);
    const rec2=mkRec(fy2,q2,wv2,ex2?.id||null);
    if(ex2){const i2=D.wexData.records.indexOf(ex2);D.wexData.records[i2]=rec2;}
    else D.wexData.records.push(rec2);
  }
  try{
    await saveWEXData();
    logActivity({category:'wex',action:_wexEditId?'edit':'add',projectId:p.id,projectName:p.name,
      description:`WEX saved FY ${fy1}${hasFY2&&fy2?' + FY '+fy2:''}`});
    CM('modal-wex-entry');
    renderDetail(_wexPid);
    toast('✓ Work experience quantities saved','ok');
  }catch(e){toast('Save failed','error');}
}

async function deleteWEXEntry(wexId,pid){
  const ok=await showConfirm({title:'Delete Entry?',message:"Remove this FY's work experience quantities?",confirmLabel:'Yes, Delete'});
  if(!ok) return;
  D.wexData.records=(D.wexData.records||[]).filter(r=>r.id!==wexId);
  await saveWEXData();
  renderDetail(pid);
  toast('Entry deleted','ok');
}

// ─── TAB VIEW ─────────────────────────────────────────
let _wexTab = 'summary'; // 'summary' | 'peak' | 'similar'

async function renderWEX(){
  const el=document.getElementById('sec-wex'); if(!el) return;
  if(!CU){el.innerHTML='<div class="wrap"><div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">Please log in.</div></div></div>';return;}
  el.innerHTML='<div class="wrap"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>';
  await loadWEXData(); await loadWEXCustomTypes();
  _renderWEXTab(el);
}

function _renderWEXTab(el){
  const allItems=getAllWEXItems();
  const records=D.wexData.records||[];
  const fys=[...new Set(records.map(r=>r.fy).filter(Boolean))].sort();
  const firms=[...new Set(records.map(r=>r.firm).filter(Boolean))].sort();

  const byFY={};
  const byFYWorkType={};

  records.forEach(r=>{
    const fy=r.fy||'Unknown', firm=r.firm||'Unknown';
    if(!byFY[fy]) byFY[fy]={firms:{},count:0,value:0,qtys:{}};
    if(!byFY[fy].firms[firm]) byFY[fy].firms[firm]={qtys:{},count:0,value:0};
    byFY[fy].firms[firm].count++;
    byFY[fy].firms[firm].value+=r.workValue||0;
    byFY[fy].count++; byFY[fy].value+=r.workValue||0;
    Object.entries(r.quantities||{}).forEach(([k,v])=>{
      byFY[fy].firms[firm].qtys[k]=(byFY[fy].firms[firm].qtys[k]||0)+v;
      byFY[fy].qtys[k]=(byFY[fy].qtys[k]||0)+v;
    });

    // Work type — use record workType first, then pull from linked project
    const p=D.projects.find(pr=>(getGenCode(pr)||'').toUpperCase()===r.genCode||(r.projectId&&pr.id===r.projectId));
    let workTypes=[];
    if(r.workType&&r.workType.trim()) workTypes=[r.workType.trim()];
    else if(p&&p.types&&p.types.length) workTypes=[...p.types];
    else if(p&&p.type) workTypes=p.type.split(',').map(t=>t.trim()).filter(Boolean);
    if(!workTypes.length) workTypes=['Other'];

    if(!byFYWorkType[fy]) byFYWorkType[fy]={};
    workTypes.forEach(wt=>{
      if(!byFYWorkType[fy][wt]) byFYWorkType[fy][wt]={value:0,count:0};
      byFYWorkType[fy][wt].value+=r.workValue||0;
      byFYWorkType[fy][wt].count++;
    });
  });

  // Find peak FY per quantity
  const peakFY={};
  allItems.forEach(item=>{
    let best={fy:null,value:0};
    Object.entries(byFY).forEach(([fy,d])=>{const v=d.qtys[item.key]||0;if(v>best.value) best={fy,value:v};});
    if(best.fy) peakFY[item.key]=best;
  });

  // Find peak FY per work type
  const allWorkTypes=[...new Set(Object.values(byFYWorkType).flatMap(d=>Object.keys(d)))].sort();
  const peakWorkTypeFY={};
  allWorkTypes.forEach(wt=>{
    let best={fy:null,value:0};
    Object.entries(byFYWorkType).forEach(([fy,d])=>{const v=d[wt]?.value||0;if(v>best.value) best={fy,value:v};});
    if(best.fy) peakWorkTypeFY[wt]=best;
  });

  // ─── ANNUAL SUMMARY ───────────────────────────────────
  const summaryHTML=Object.keys(byFY).sort().reverse().map(fy=>{
    const d=byFY[fy];
    const qRows=allItems.filter(i=>(d.qtys[i.key]||0)>0).map(i=>{
      const isPeak=peakFY[i.key]?.fy===fy;
      return `<tr style="${isPeak?'background:#fef9c3':''}">
        <td style="padding:6px 10px;font-size:12px">${i.label}${isPeak?'<span style="font-size:10px;background:#facc15;color:#713f12;padding:1px 7px;border-radius:8px;margin-left:6px;font-weight:700">★ Best</span>':''}</td>
        <td style="padding:6px 8px;text-align:center;font-size:11px;color:var(--text3)">${i.unit}</td>
        ${firms.map(firm=>{const v=byFY[fy].firms[firm]?.qtys[i.key];return `<td style="padding:6px 10px;text-align:right;font-size:12px;font-weight:600">${v?v.toFixed(2):'—'}</td>`;}).join('')}
        <td style="padding:6px 10px;text-align:right;font-size:${isPeak?'14':'13'}px;font-weight:800;color:${isPeak?'#b45309':'var(--navy)'}">${(d.qtys[i.key]||0).toFixed(2)}</td>
      </tr>`;
    }).join('');
    return `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div><div style="font-size:16px;font-weight:800;color:var(--navy)">FY ${fy}</div>
          <div style="font-size:12px;color:var(--text3)">${d.count} project${d.count>1?'s':''} · <strong>${fmt(d.value)}</strong></div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${firms.map(f=>`<span style="font-size:11px;padding:3px 10px;background:var(--surface2);border-radius:8px">${f.replace('RSR Constructions','RSR').replace('R Sadhu Rao','RS Rao')}: ${byFY[fy].firms[f]?.count||0}</span>`).join('')}
        </div>
      </div>
      ${qRows?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:380px">
        <thead><tr style="background:var(--navy);color:#fff">
          <th style="padding:6px 10px;text-align:left;font-size:11px">Item</th>
          <th style="padding:6px 8px;text-align:center;font-size:11px">Unit</th>
          ${firms.map(f=>`<th style="padding:6px 10px;text-align:right;font-size:11px">${f.replace('RSR Constructions','RSR').replace('R Sadhu Rao','RS Rao')}</th>`).join('')}
          <th style="padding:6px 10px;text-align:right;font-size:11px">Total</th>
        </tr></thead><tbody>${qRows}</tbody>
      </table></div>`:'<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">No quantities.</div>'}
    </div>`;
  }).join('');

  // ─── PEAK YEAR VIEW ───────────────────────────────────
  const peakHTML=`<div class="card" style="margin-bottom:14px;border-top:3px solid #facc15">
    <div style="font-size:13px;color:#713f12;margin-bottom:14px;padding:10px 12px;background:#fef9c3;border-radius:var(--rs)">
      ★ <strong>Best Financial Year per Quantity</strong> — when a tender asks "minimum X in any one financial year", find your quantity below and use the highlighted FY as your reference.
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:500px">
      <thead><tr style="background:var(--navy);color:#fff">
        <th style="padding:8px 12px;text-align:left;font-size:11px">Quantity Item</th>
        <th style="padding:8px 8px;text-align:center;font-size:11px">Unit</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px">Best FY</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px">Peak Amount</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px">All FYs</th>
      </tr></thead>
      <tbody>${allItems.filter(i=>peakFY[i.key]).map(i=>{
        const peak=peakFY[i.key];
        const allFYvals=Object.entries(byFY)
          .filter(([,d])=>(d.qtys[i.key]||0)>0)
          .sort((a,b)=>a[0].localeCompare(b[0]))
          .map(([fy,d])=>`<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:${fy===peak.fy?'#facc15':'var(--surface2)'};color:${fy===peak.fy?'#713f12':'var(--text2)'};font-weight:${fy===peak.fy?700:400};margin-right:3px;white-space:nowrap;display:inline-block;margin-bottom:2px">${fy}: ${d.qtys[i.key].toFixed(2)}</span>`).join('');
        return `<tr style="border-bottom:1px solid var(--surface2)">
          <td style="padding:8px 12px;font-size:12px;font-weight:600">${i.label}</td>
          <td style="padding:8px 8px;text-align:center;font-size:11px;color:var(--text3)">${i.unit}</td>
          <td style="padding:8px 12px;text-align:center"><span style="background:#facc15;color:#713f12;font-size:12px;font-weight:800;padding:3px 12px;border-radius:8px">FY ${peak.fy}</span></td>
          <td style="padding:8px 12px;text-align:right;font-size:15px;font-weight:800;color:#b45309">${peak.value.toFixed(2)}</td>
          <td style="padding:8px 12px;line-height:1.8">${allFYvals}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;

  // ─── SIMILAR WORKS VIEW ───────────────────────────────
  const similarHTML=`<div class="card" style="margin-bottom:14px;border-top:3px solid #7c3aed">
    <div style="font-size:13px;color:#6d28d9;margin-bottom:14px;padding:10px 12px;background:#f5f3ff;border-radius:var(--rs)">
      🏗️ <strong>Similar Nature of Work — Value per FY</strong> — when a tender asks "similar works value ≥ ₹X in any one FY for this work type", use the highlighted FY for your reference.
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:500px">
      <thead><tr style="background:#7c3aed;color:#fff">
        <th style="padding:8px 12px;text-align:left;font-size:11px">Work Type</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px">Best FY</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px">Peak Value (₹)</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px">All FYs</th>
      </tr></thead>
      <tbody>${allWorkTypes.map(wt=>{
        const peak=peakWorkTypeFY[wt]; if(!peak) return '';
        const allFYvals=Object.entries(byFYWorkType)
          .filter(([,d])=>d[wt])
          .sort((a,b)=>a[0].localeCompare(b[0]))
          .map(([fy,d])=>`<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:${fy===peak.fy?'#ede9fe':'var(--surface2)'};color:${fy===peak.fy?'#7c3aed':'var(--text2)'};font-weight:${fy===peak.fy?700:400};margin-right:3px;white-space:nowrap;display:inline-block;margin-bottom:2px">${fy}: ${fmt(d[wt].value)} (${d[wt].count})</span>`).join('');
        return `<tr style="border-bottom:1px solid var(--surface2)">
          <td style="padding:8px 12px;font-size:13px;font-weight:700;color:var(--navy)">${wt}</td>
          <td style="padding:8px 12px;text-align:center"><span style="background:#ede9fe;color:#7c3aed;font-size:12px;font-weight:800;padding:3px 12px;border-radius:8px">FY ${peak.fy}</span></td>
          <td style="padding:8px 12px;text-align:right;font-size:15px;font-weight:800;color:#7c3aed">${fmt(peak.value)}</td>
          <td style="padding:8px 12px;line-height:1.8">${allFYvals}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;

  const tabs=[
    {key:'summary',icon:'📊',label:'Annual Summary'},
    {key:'peak',   icon:'★', label:'Best FY per Quantity'},
    {key:'similar',icon:'🏗️',label:'Similar Works Value'},
  ];

  el.innerHTML=`<div class="wrap">
    <div class="pg-hdr">
      <div><div class="pg-title">📐 Work Experience</div>
        <div style="font-size:12px;color:var(--text3)">${records.length} entries · ${fys.length} FYs · Open projects to add quantities</div>
      </div>
      <button onclick="exportWEXToExcel()" style="background:var(--gold);color:var(--navy);border:none;border-radius:var(--rs);padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">📊 Export Excel</button>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--surface2);border-radius:var(--rs);padding:4px;flex-wrap:wrap">
      ${tabs.map(t=>`<button onclick="_wexTab='${t.key}';_renderWEXTab(document.getElementById('sec-wex'))"
        style="flex:1;min-width:120px;padding:8px 12px;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;
          background:${_wexTab===t.key?'#fff':'transparent'};color:${_wexTab===t.key?'var(--navy)':'var(--text3)'};
          box-shadow:${_wexTab===t.key?'0 1px 4px rgba(0,0,0,.1)':'none'}">${t.icon} ${t.label}</button>`).join('')}
    </div>
    ${_wexTab==='summary'?(summaryHTML||'<div class="empty"><div class="empty-icon">📐</div><div class="empty-text">No data yet.</div></div>'):''}
    ${_wexTab==='peak'?(records.length?peakHTML:'<div class="empty"><div class="empty-icon">★</div><div class="empty-text">No data yet.</div></div>'):''}
    ${_wexTab==='similar'?(records.length?similarHTML:'<div class="empty"><div class="empty-icon">🏗️</div><div class="empty-text">No data yet.</div></div>'):''}
  </div>`;
}
// ─── EXPORT ───────────────────────────────────────────
async function exportWEXToExcel(){
  if(!window.XLSX){toast('Excel library not loaded','error');return;}
  const allItems=getAllWEXItems();
  const records=D.wexData.records||[];
  const wb=window.XLSX.utils.book_new();
  const hdr=['FY','Firm','Gen Code','Project','Work Value (₹)',...allItems.map(i=>`${i.label}(${i.unit})`)];
  const rows=records.sort((a,b)=>(a.fy+a.genCode).localeCompare(b.fy+b.genCode)).map(r=>{
    const p=D.projects.find(pr=>(getGenCode(pr)||'').toUpperCase()===r.genCode)||{name:'—'};
    return [r.fy,r.firm||'',r.genCode,p.name,r.workValue||0,...allItems.map(i=>(r.quantities||{})[i.key]||0)];
  });
  const ws=window.XLSX.utils.aoa_to_sheet([hdr,...rows]);
  window.XLSX.utils.book_append_sheet(wb,ws,'Work Experience');
  window.XLSX.writeFile(wb,`RSR_Work_Experience_${new Date().getFullYear()}.xlsx`);
  toast('✓ Exported','ok');
}

// ─── INIT ─────────────────────────────────────────────
if(typeof D!=='undefined'){loadWEXData().catch(()=>{});loadWEXCustomTypes().catch(()=>{});}
