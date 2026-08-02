import type { Vector } from "apache-arrow";
import { Float64, Int32, makeData, makeVector, Utf8 } from "apache-arrow";

export function utf8Vector(
	values: readonly (string | null | undefined)[],
): Vector {
	let byteLength = 0;
	const offsets = new Int32Array(values.length + 1);
	for (let i = 0; i < values.length; i++) {
		const value = values[i] ?? "";
		offsets[i] = byteLength;
		byteLength += new TextEncoder().encode(value).byteLength;
	}
	offsets[values.length] = byteLength;
	const data = new Uint8Array(byteLength);
	for (let i = 0; i < values.length; i++) {
		const value = values[i] ?? "";
		const encoded = new TextEncoder().encode(value);
		data.set(encoded, offsets[i]);
	}
	const type = new Utf8();
	return makeVector(
		makeData({
			type,
			length: values.length,
			nullCount: 0,
			valueOffsets: offsets,
			data,
		}),
	);
}

export function float64Vector(values: readonly number[]): Vector {
	const type = new Float64();
	return makeVector(
		makeData({
			type,
			length: values.length,
			nullCount: 0,
			data: Float64Array.from(values),
		}),
	);
}

export function int32Vector(values: readonly number[]): Vector {
	const type = new Int32();
	return makeVector(
		makeData({
			type,
			length: values.length,
			nullCount: 0,
			data: Int32Array.from(values),
		}),
	);
}
