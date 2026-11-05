import { describe, expect, it } from "vitest";
import { applyRounding, currencyDecimals, formatMoney, roundMoney } from "@/lib/money";

describe("redondeo de precios por market", () => {
  it("termina en ,99 y ,90", () => {
    expect(applyRounding(18.4, "99", "USD")).toBe(18.99);
    expect(applyRounding(18.4, "90", "EUR")).toBe(18.9);
    expect(applyRounding(1234.01, "99", "BRL")).toBe(1234.99);
  });
  it("monedas sin centavos no quedan con decimales", () => {
    expect(currencyDecimals("JPY")).toBe(0);
    expect(applyRounding(1840.4, "99", "JPY")).toBe(1840);
    expect(Number.isInteger(applyRounding(15999.7, "90", "CLP"))).toBe(true);
  });
  it("entero, decena y 990", () => {
    expect(applyRounding(18.4, "integer", "USD")).toBe(18);
    expect(applyRounding(184, "10", "ARS")).toBe(190);
    expect(applyRounding(18420, "990", "ARS")).toBe(18990);
    expect(applyRounding(18990, "990", "ARS")).toBe(18990);
    expect(applyRounding(18991, "990", "ARS")).toBe(19990);
    expect(applyRounding(120, "990", "ARS")).toBe(990);
  });
  it("sin redondeo usa los decimales de la moneda", () => {
    expect(applyRounding(10.005, "none", "USD")).toBe(10.01);
    expect(roundMoney(0.1 + 0.2, "USD")).toBe(0.3);
  });
  it("cero o negativo da 0", () => {
    expect(applyRounding(0, "99", "USD")).toBe(0);
    expect(applyRounding(-5, "990", "ARS")).toBe(0);
  });
});

describe("formato de montos", () => {
  it("formatea con el símbolo y los decimales de cada moneda", () => {
    expect(formatMoney(12.99, "USD", "es")).toMatch(/12,99/);
    expect(formatMoney(18990, "ARS", "es")).toMatch(/18\.990/);
    expect(formatMoney(1500, "JPY", "en")).not.toMatch(/\.00/);
  });
});
