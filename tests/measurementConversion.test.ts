import { describe, it, expect } from 'vitest';
import {
  convertWeightValue,
  convertLengthValue,
  convertTemperatureValue,
} from '@/src/utils/measurementConversion';

describe('convertWeightValue', () => {
  it('converts pounds to kilograms', () => {
    expect(convertWeightValue(7.5, 'lb', 'kg')).toBeCloseTo(3.40194, 4);
  });

  it('converts kilograms to pounds', () => {
    expect(convertWeightValue(3.40194, 'kg', 'lb')).toBeCloseTo(7.5, 4);
  });

  it('converts kilograms to whole grams', () => {
    expect(convertWeightValue(3.5, 'kg', 'g')).toBe(3500);
  });

  it('converts grams to pounds', () => {
    expect(convertWeightValue(3500, 'g', 'lb')).toBeCloseTo(7.716, 2);
  });

  it('passes through when units match', () => {
    expect(convertWeightValue(3.5, 'kg', 'kg')).toBe(3.5);
  });

  it('round-trips lb -> kg -> lb', () => {
    expect(convertWeightValue(convertWeightValue(7.5, 'lb', 'kg'), 'kg', 'lb')).toBeCloseTo(7.5, 6);
  });
});

describe('convertLengthValue', () => {
  it('converts inches to centimeters', () => {
    expect(convertLengthValue(10, 'in', 'cm')).toBeCloseTo(25.4, 6);
  });

  it('converts centimeters to inches', () => {
    expect(convertLengthValue(25.4, 'cm', 'in')).toBeCloseTo(10, 6);
  });

  it('passes through when units match', () => {
    expect(convertLengthValue(20, 'in', 'in')).toBe(20);
    expect(convertLengthValue(50, 'cm', 'cm')).toBe(50);
  });

  it('round-trips in -> cm -> in', () => {
    expect(convertLengthValue(convertLengthValue(18.5, 'in', 'cm'), 'cm', 'in')).toBeCloseTo(18.5, 6);
  });
});

describe('convertTemperatureValue', () => {
  it('converts Fahrenheit to Celsius', () => {
    expect(convertTemperatureValue(98.6, '°F', '°C')).toBeCloseTo(37, 4);
    expect(convertTemperatureValue(32, 'F', 'C')).toBeCloseTo(0, 6);
  });

  it('converts Celsius to Fahrenheit', () => {
    expect(convertTemperatureValue(37, '°C', '°F')).toBeCloseTo(98.6, 4);
    expect(convertTemperatureValue(0, 'C', 'F')).toBeCloseTo(32, 6);
  });

  it('passes through when units match', () => {
    expect(convertTemperatureValue(98.6, '°F', '°F')).toBe(98.6);
    expect(convertTemperatureValue(37, '°C', '°C')).toBe(37);
  });

  it('round-trips F -> C -> F', () => {
    expect(convertTemperatureValue(convertTemperatureValue(99.1, '°F', '°C'), '°C', '°F')).toBeCloseTo(99.1, 4);
  });
});
