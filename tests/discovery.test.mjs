import assert from "node:assert/strict";
import test from "node:test";
import {
  filterByBudget,
  formatLocationRegion,
  isLunchRestaurantPoi,
  isMainlandChinaAdcode,
  isMainlandChinaCoordinate,
  isValidAmapCityCode,
  normalizeAmapPois,
  normalizeCost,
  radiusForMinutes,
} from "../lib/discovery.js";
import { sampleCandidates } from "../lib/roulette.js";

test("maps the three lunch walking choices to fixed radiuses", () => {
  assert.equal(radiusForMinutes(5), 400);
  assert.equal(radiusForMinutes(10), 800);
  assert.equal(radiusForMinutes(15), 1200);
  assert.equal(radiusForMinutes(20), null);
});

test("normalizes missing, invalid, and valid Amap costs", () => {
  assert.equal(normalizeCost(undefined), null);
  assert.equal(normalizeCost(""), null);
  assert.equal(normalizeCost("not-a-price"), null);
  assert.equal(normalizeCost("39.5"), 39.5);
});

test("applies strict budgets and keeps unknown costs only for unlimited", () => {
  const restaurants = [{ id: "a", cost: 28 }, { id: "b", cost: 40 }, { id: "c", cost: null }];
  assert.deepEqual(filterByBudget(restaurants, 30).map((item) => item.id), ["a"]);
  assert.deepEqual(filterByBudget(restaurants, 40).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(filterByBudget(restaurants, null).map((item) => item.id), ["a", "b", "c"]);
});

test("recognizes mainland China coordinates, adcodes, and city codes", () => {
  assert.equal(isMainlandChinaCoordinate(121.4737, 31.2304), true);
  assert.equal(isMainlandChinaCoordinate(120.1551, 30.2741), true);
  assert.equal(isMainlandChinaCoordinate(116.4074, 39.9042), true);
  assert.equal(isMainlandChinaCoordinate(104.0665, 30.5723), true);
  assert.equal(isMainlandChinaCoordinate(139.6917, 35.6895), false);
  assert.equal(isMainlandChinaAdcode("310104"), true);
  assert.equal(isMainlandChinaAdcode("330106"), true);
  assert.equal(isMainlandChinaAdcode("110105"), true);
  assert.equal(isMainlandChinaAdcode("810000"), false);
  assert.equal(isMainlandChinaAdcode("820000"), false);
  assert.equal(isValidAmapCityCode("021"), true);
  assert.equal(isValidAmapCityCode("0571"), true);
  assert.equal(isValidAmapCityCode("city"), false);
});

test("formats municipality and ordinary city location labels", () => {
  assert.equal(formatLocationRegion({ province: "上海市", city: "" }), "上海市");
  assert.equal(formatLocationRegion({ province: "浙江省", city: "杭州市" }), "浙江省 · 杭州市");
  assert.equal(formatLocationRegion({}), "当前位置");
});

test("keeps lunch restaurants and excludes beverage, dessert, and bakery POIs", () => {
  const restaurant = (name, type, typecode = "050100") => ({ name, type, typecode });
  const excluded = [
    restaurant("星巴克(测试店)", "餐饮服务;咖啡厅", "050501"),
    restaurant("瑞幸咖啡(测试店)", "餐饮服务;餐饮相关场所", "051200"),
    restaurant("Manner Coffee", "餐饮服务;咖啡厅", "050500"),
    restaurant("快乐奶茶", "餐饮服务;冷饮店", "050700"),
    restaurant("清凉冰淇淋", "餐饮服务;冷饮店", "050700"),
    restaurant("每日甜品", "餐饮服务;甜品店", "050900"),
    restaurant("麦香糕饼店", "餐饮服务;糕饼店", "050800"),
  ];
  assert.ok(excluded.every((poi) => !isLunchRestaurantPoi(poi)));

  const kept = [
    restaurant("老乡鸡", "餐饮服务;中餐厅;中式快餐"),
    restaurant("肯德基", "餐饮服务;快餐厅"),
    restaurant("面霸面馆", "餐饮服务;中餐厅;面馆"),
    restaurant("喜家德水饺", "餐饮服务;中餐厅;饺子馆"),
    restaurant("荷特宝食堂", "餐饮服务;中餐厅"),
    restaurant("张正发茶餐厅", "餐饮服务;中餐厅;茶餐厅"),
  ];
  assert.ok(kept.every((poi) => isLunchRestaurantPoi(poi)));
});

test("filters non-meal POIs before normalization and deduplication", () => {
  const base = {
    location: "121.4737,31.2304",
    adcode: "310104",
    citycode: "021",
    distance: "300",
    biz_ext: { cost: "35" },
  };
  const results = normalizeAmapPois([
    { ...base, id: "meal", name: "测试面馆", type: "餐饮服务;中餐厅;面馆", typecode: "050100" },
    { ...base, id: "coffee", name: "测试咖啡", type: "餐饮服务;咖啡厅", typecode: "050500" },
    { ...base, id: "tea", name: "测试奶茶", type: "餐饮服务;餐饮相关场所", typecode: "051200" },
    { ...base, id: "meal", name: "测试面馆", type: "餐饮服务;中餐厅;面馆", typecode: "050100" },
  ]);
  assert.deepEqual(results.map((item) => item.id), ["meal"]);
});

test("normalizes, filters, and deduplicates Amap POIs", () => {
  const valid = {
    id: "B001",
    name: "测试面馆",
    location: "121.4737,31.2304",
    adcode: "310104",
    citycode: "021",
    type: "餐饮服务;中餐厅;面馆",
    distance: "360",
    address: "测试路 1 号",
    biz_ext: { cost: "32" },
  };
  const results = normalizeAmapPois([
    valid,
    valid,
    { ...valid, id: "" },
    { ...valid, id: "B002", adcode: "110105", citycode: "010", location: "116.4074,39.9042" },
  ], "021");
  assert.equal(results.length, 1);
  assert.equal(results[0].cost, 32);
  assert.equal(results[0].source, "amap");
  assert.equal("rating" in results[0], false);
});

test("normalizes restaurants in Hangzhou and other mainland cities", () => {
  const hangzhou = normalizeAmapPois([{
    id: "HZ001",
    name: "杭州测试面馆",
    location: "120.1551,30.2741",
    adcode: "330106",
    citycode: "0571",
    type: "餐饮服务;中餐厅;面馆",
    distance: "280",
    biz_ext: { cost: "30" },
  }], "0571");
  assert.deepEqual(hangzhou.map((item) => item.id), ["HZ001"]);
});

test("keeps all candidates up to 30 and samples 30 unique candidates above the limit", () => {
  const thirty = Array.from({ length: 30 }, (_, index) => ({ id: `r${index}` }));
  assert.deepEqual(sampleCandidates(thirty, 30), thirty);

  const thirtyOne = [...thirty, { id: "r30" }];
  const sample = sampleCandidates(thirtyOne, 30, () => 0.5);
  assert.equal(sample.length, 30);
  assert.equal(new Set(sample.map((item) => item.id)).size, 30);
  assert.ok(sample.every((item) => thirtyOne.includes(item)));
});
