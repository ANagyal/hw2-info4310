// Flexible legend-drawing function - Jeff Rzeszotarski, 2022
//   Released under MIT Free license
//  Takes in an SVG element selector <legendSelector> and a d3 color scale <legendColorScale>
//
// Usage example: drawLegend("#legendID", grossIncomeColorScale)
function drawLegend(legendSelector, legendColorScale) {
	// Configuration constants
	const offsets = { width: 0, top: 0, bottom: 0 };
	const stepSize = 4;
	const minMaxExtendPercent = 0;

	// Select the legend SVG element
	const legend = d3.select(legendSelector);
	legend.attr("overflow", "visible");
	const legendHeight = +legend.attr("height");
	const legendBarWidth = +legend.attr("width") - offsets.width * 2;
	const legendMinMax = d3.extent(legendColorScale.domain());
	const minMaxExtension = (legendMinMax[1] - legendMinMax[0]) * minMaxExtendPercent;
	const barHeight = legendHeight - offsets.top - offsets.bottom;

	// Clear existing legend content
	legend.selectAll("*").remove();

	// Define the scale for the legend's axis
	let barScale = d3
		.scaleLinear()
		.domain([legendMinMax[0] - minMaxExtension, legendMinMax[1] + minMaxExtension])
		.range([0, legendBarWidth]);
	let barAxis = d3.axisBottom(barScale);

	// Group for the color bar
	let bar = legend
		.append("g")
		.attr("class", "legend colorbar")
		.attr("transform", `translate(${offsets.width},${offsets.top})`);

	// Determine the type of color scale and render accordingly
	if (
		legendColorScale.hasOwnProperty("thresholds") ||
		legendColorScale.hasOwnProperty("quantiles")
	) {
		// Binning scale
		let thresholds = legendColorScale.hasOwnProperty("thresholds")
			? legendColorScale.thresholds()
			: legendColorScale.quantiles();
		const barThresholds = [legendMinMax[0], ...thresholds, legendMinMax[1]];

		barAxis.tickValues(barThresholds);

		// Draw rectangles for each threshold segment
		bar
			.selectAll("rect")
			.data(d3.pairs(barThresholds))
			.enter()
			.append("rect")
			.attr("x", (d) => barScale(d[0]))
			.attr("y", 0)
			.attr("width", (d) => barScale(d[1]) - barScale(d[0]))
			.attr("height", barHeight)
			.style("fill", (d) => legendColorScale((d[0] + d[1]) / 2))
			.style("opacity", 0)
			.style("opacity", 1);

		legend
			.selectAll("text.legend.text")
			.data(d3.pairs(barThresholds))
			.enter()
			.append("text")
			.attr("class", "legend text")
			.attr("x", (d) => barScale(d[0]))
			.attr("y", 0)
			.text((d) => console.log((d[0] + d[1]) / 2))
			.style("opacity", 0)
			.style("opacity", 1);
	} else if (legendColorScale.hasOwnProperty("rangeRound")) {
		// Continuous scale
		const pixels = d3.range(0, legendBarWidth, stepSize);
		bar
			.selectAll("rect")
			.data(pixels)
			.enter()
			.append("rect")
			.attr("x", (d) => d)
			.attr("y", 0)
			.attr("width", stepSize)
			.attr("height", barHeight)
			.style("fill", (d) => {
				const dataValue = barScale.invert(d + stepSize / 2);
				return legendColorScale(dataValue);
			})
			.style("opacity", 0)
			.style("opacity", 1);

		legend
			.selectAll("text.legend.text")
			.data(pixels)
			.enter()
			.append("text")
			.attr("class", "legend text")
			.attr("x", (d) => d)
			.attr("y", 0)
			.text((d) => console.log(barScale.invert(d + stepSize / 2)))
			.style("opacity", 0)
			.style("opacity", 1);
	} else {
		// Nominal scale
		let nomVals = legendColorScale.domain().sort();
		let barScale = d3
			.scaleBand()
			.domain(nomVals)
			.range([0, legendBarWidth])
			.padding(0.05);
		barAxis.scale(barScale);

		bar
			.selectAll("rect")
			.data(nomVals)
			.enter()
			.append("rect")
			.attr("x", (d) => barScale(d))
			.attr("y", 0)
			.attr("id", (d) => d)
			.attr("width", barScale.bandwidth())
			.attr("height", barHeight)
			.style("fill", (d) => legendColorScale(d))
			.style("opacity", 0)
			.style("opacity", 1);

		legend
			.selectAll("text.legend.text")
			.data(nomVals)
			.enter()
			.append("text")
			.attr("class", (d) => "legend text " + d)
			.text((d) => d)
			.attr("fill", "black")
			.style("font-weight", "bold")
			.attr("text-anchor", "middle")
			.attr("alignment-baseline", "middle")
			.attr(
				"transform",
				`translate(${offsets.width},${barHeight + offsets.top + 2.5})` + " rotate(-90)"
			)
			.attr("x", (d) => {
				const x = -(barScale(d) + barScale.bandwidth() / 2);
				const y = barHeight / 2;
				const a = -Math.PI / 2;
				return Math.cos(a) * x - Math.sin(a) * y;
			})
			.attr("y", (d) => {
				const x = -(barScale(d) + barScale.bandwidth() / 2);
				const y = barHeight / 2;
				const a = -Math.PI / 2;
				return Math.sin(a) * x + Math.cos(a) * y;
			})
			.style("opacity", 0)
			.style("opacity", 1);
	}
}
