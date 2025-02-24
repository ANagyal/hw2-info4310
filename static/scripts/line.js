const svg = d3.select("svg#line");
const width = svg.attr("width");
const height = svg.attr("height");

const margin = { top: 10, right: 30, bottom: 60, left: 40 };
const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

const annotations = svg
	.append("g")
	.attr("id", "annotations")
	.attr("transform", `translate(${margin.left},${margin.top})`);

const chartArea = svg
	.append("g")
	.attr("transform", `translate(${margin.left},${margin.top})`);

const requestData = async function () {
	const data = await d3.csv("dataset/vgchartz_3d_FILTERED.csv", d3.autoType);

	data.forEach((d) => {
		d.total_sales = +d.total_sales;
		d.release_date = new Date(d.release_date).getFullYear();
	});

	const aggregatedData = d3
		.flatRollup(
			data,
			(D) => d3.sum(D, (d) => d.total_sales),
			(v) => v.release_date,
			(d) => d.genre
		)
		.map(([year, genre, total_sales]) => ({ year, genre, total_sales }))
		.sort((a, b) => d3.ascending(a.year, b.year));

	let groups = d3.groups(aggregatedData, (d) => d.genre);

	const x = d3.scaleLinear(
		d3.extent(aggregatedData, (d) => d.year),
		[0, chartWidth]
	);
	annotations
		.append("g")
		.attr("transform", `translate(0, ${chartHeight})`)
		.attr("class", "x axis")
		.call(d3.axisBottom(x).ticks(d3.groups(aggregatedData, (d) => d.year).length, "d"))
		.selectAll("text")
		.style("text-anchor", "end")
		.attr("dx", "-.5em")
		.attr("dy", ".25em")
		.attr("transform", "rotate(-65)");

	const y = d3.scaleLinear(
		d3.extent(aggregatedData, (d) => d.total_sales),
		[chartHeight, 0]
	);
	annotations
		.append("g")
		.attr("class", "y axis")
		.call(d3.axisLeft(y))
		.call((g) => g.select(".domain").remove());
	annotations
		.append("g")
		.attr("class", "y grid")
		.call(d3.axisLeft(y).tickSize(-chartWidth).tickFormat(""))
		.call((g) => g.select(".domain").remove());

	const line = d3
		.line()
		.x((d) => x(d.year))
		.y((d) => y(d.total_sales));

	const color = d3.scaleOrdinal([...groups.keys()], [...d3.schemeSet1, ...d3.schemeSet3]);

	let gTags = chartArea
		.selectAll(".ag")
		.data(groups)
		.join("g")
		.attr("class", "ag")
		.style("stroke", (d) => color(d[0]));

	gTags
		.append("path")
		.attr("d", (d) => line(d[1]))
		.style("stroke-width", 2)
		.style("fill", "none");

	gTags
		.selectAll("circle")
		.data((d) => d[1])
		.join("circle")
		.attr("fill", (d) => color(d.genre))
		.attr("r", 2)
		.attr("cx", (d) => x(d.year))
		.attr("cy", (d) => y(d.total_sales));

	drawLegend("#line-legend", color);
};

requestData();
