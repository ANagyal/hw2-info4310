let globalFilters = new Map();
const svg = d3.select("svg#stack");

const filterData = async function () {
	// Load in the dataset
	const data = await d3.csv("dataset/vgchartz_3d_FILTERED.csv", d3.autoType);

	// Filter the data according to the selected filters
	const conSelections = globalFilters.get("console");
	const devSelections = globalFilters.get("developer");

	const conFiltered = data.filter((d) => conSelections.has(d["console"]));
	const devFiltered = data.filter((d) => devSelections.has(d["developer"]));

	const filtered = [...conFiltered, ...devFiltered];

	drawStack(filtered.length ? filtered : data);
};

const drawStack = function (data) {
	console.log(data);

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

	// Aggregate the data by summing up the total sales for each genre and every year
	const aggregatedData = d3
		.flatRollup(
			data,
			(v) => d3.sum(v, (d) => +d.total_sales),
			(d) => d.release_date.getFullYear(),
			(d) => d.genre
		)
		.map(([year, genre, total_sales]) => ({ year, genre, total_sales }))
		.sort((a, b) => d3.ascending(a.year, b.year));

	// Group everything by year using an intern map
	const grouped = d3.group(aggregatedData, (d) => d.year);

	// Create an array of each genre
	const mygroups = [...d3.group(aggregatedData, (d) => d.genre).keys()];

	// Create the stacks of total sale values and order by descending
	const stackedData = d3
		.stack()
		.keys(mygroups)
		.value((d, key) => {
			const entry = d[1].find((d) => d.genre === key);
			return entry ? entry.total_sales : 0;
		})
		.order(d3.stackOrderDescending)(grouped);

	// Create scales
	const x = d3.scaleLinear(
		d3.extent(grouped, (d) => d[0]),
		[0, chartWidth]
	);
	const y = d3.scaleLinear(d3.extent(stackedData.flat(2)), [chartHeight, 0]);
	const color = d3.scaleOrdinal(mygroups, [...d3.schemeSet1, ...d3.schemeSet3]);

	// Append axes and gridlines
	annotations
		.append("g")
		.attr("class", "x axis")
		.attr("transform", `translate(0, ${chartHeight})`)
		.call(d3.axisBottom(x).ticks(grouped.size, "d"))
		.selectAll("text")
		.style("text-anchor", "end")
		.attr("dx", "-.5em")
		.attr("dy", ".25em")
		.attr("transform", "rotate(-65)");
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

	// Create, draw, and color the areas
	chartArea
		.selectAll("path.layer")
		.data(stackedData)
		.join("path")
		.attr("class", "layer")
		.attr(
			"d",
			d3
				.area()
				.x(function (d, i) {
					return x(d.data[0]);
				})
				.y0(function (d) {
					return y(d[0]);
				})
				.y1(function (d) {
					return y(d[1]);
				})
		)
		.style("fill", (d) => color(d.key))
		.style("cursor", "pointer")
		.on("click", () => {
			if (d3.selectAll("path.layer").on("mouseout") === undefined) {
				d3.selectAll("path.layer").on("mouseover", mouseIn);
				d3.selectAll("path.layer").on("mouseout", mouseOut);
			} else {
				d3.selectAll("path.layer").on("mouseover", null);
				d3.selectAll("path.layer").on("mouseout", null);
			}
		})
		.on("mouseover", mouseIn)
		.on("mouseout", mouseOut);

	const previewContainer = d3.select("#stack-preview-cont");

	const genreText = previewContainer
		.append("p")
		.attr("class", "tooltip")
		.attr("text-anchor", "middle")
		.attr("alignment-baseline", "hanging");

	const lifetimeSalesText = previewContainer
		.append("p")
		.attr("class", "tooltip")
		.attr("text-anchor", "middle")
		.attr("alignment-baseline", "hanging");

	function mouseClick(ev) {}

	function mouseIn(ev) {
		const thisLayer = d3.select(this);
		const allLayers = d3.selectAll("path.layer");
		const datum = thisLayer.datum();
		const layer = stackedData.find((d) => d === datum);

		const genre = layer.key;
		let lifetimeSales = layer.reduce((pv, cv) => {
			return cv[1] - cv[0] + pv;
		}, 0);
		lifetimeSales =
			lifetimeSales < 1000
				? d3.format(".1f")(lifetimeSales) + "M"
				: d3.format(".2f")(lifetimeSales / 1000) + "B";

		genreText.text("Genre: " + genre);
		lifetimeSalesText.text("Lifetime Sales: " + lifetimeSales);

		allLayers.style("opacity", 0.4);
		thisLayer.style("stroke", "white").style("stroke-width", 1).style("opacity", 1);
	}

	function mouseOut() {
		genreText.text("");
		lifetimeSalesText.text("");
		d3.select(this).style("stroke", "none");
		d3.selectAll("path.layer").style("opacity", 1);
	}

	drawLegend("#stack-legend", color);
};

const createFilters = function (data) {
	const conFilters = d3
		.rollups(
			data,
			(v) => d3.sum(v, (d) => +d.total_sales),
			(d) => d.console
		)
		.sort((a, b) => d3.descending(a[1], b[1]))
		.map(([console]) => console)
		.slice(0, 29);

	const devFilters = d3
		.rollups(
			data,
			(v) => d3.sum(v, (d) => +d.total_sales),
			(d) => d.developer
		)
		.sort((a, b) => d3.descending(a[1], b[1]))
		.map(([developer]) => developer)
		.slice(0, 30);

	const filterKeys = ["console", "developer"];

	globalFilters.set("console", new Set());
	globalFilters.set("developer", new Set());

	const filterContainer = d3.select("div#stack-filter-cont");

	const conFieldset = filterContainer
		.append("fieldset")
		.attr("class", "stack-fieldset")
		.style("display", "grid")
		.style("grid-template-columns", "auto auto auto auto auto");

	conFieldset.append("legend").text("Console");

	const devFieldset = filterContainer
		.append("fieldset")
		.attr("class", "stack-fieldset")
		.style("display", "grid")
		.style("grid-template-columns", "auto auto");

	devFieldset.append("legend").text("Developer");

	const conDivs = conFieldset
		.selectAll("div.stack-input-div")
		.data(conFilters)
		.join("div")
		.attr("class", "stack-input-div console")
		.attr("id", (d) => "stack-input-div-" + d)
		.style("display", "flex")
		.style("flex-direction", "row")
		.style("align-items", "centers");

	const devDivs = devFieldset
		.selectAll("div.stack-input-div")
		.data(devFilters)
		.join("div")
		.attr("class", "stack-input-div console")
		.attr("id", (d) => "stack-input-div-" + d)
		.style("display", "flex")
		.style("flex-direction", "row")
		.style("align-items", "centers");

	const conInputs = conDivs
		.append("input")
		.attr("class", "console")
		.attr("type", "checkbox")
		.attr("id", (d) => d + "")
		.attr("name", (d) => d + "")
		.on("input", function () {
			this.checked
				? globalFilters.get(this.className).add(this.id)
				: globalFilters.get(this.className).delete(this.id);
			svg.selectAll("*").remove();
			d3.select("#stack-legend").selectAll("*").remove();
			filterData();
		});

	const devInputs = devDivs
		.append("input")
		.attr("class", "developer")
		.attr("type", "checkbox")
		.attr("id", (d) => d)
		.attr("name", (d) => d)
		.on("input", function () {
			this.checked
				? globalFilters.get(this.className).add(this.id)
				: globalFilters.get(this.className).delete(this.id);
			svg.selectAll("*").remove();
			d3.select("#stack-legend").selectAll("*").remove();
			filterData();
		});

	conDivs
		.append("label")
		.attr("class", "stack-label")
		.attr("for", (d) => d)
		.text((d) => d);

	devDivs
		.append("label")
		.attr("class", "stack-label")
		.attr("for", (d) => d + "")
		.text((d) => d);

	filterData();
};

createFilters(await d3.csv("dataset/vgchartz_3d_FILTERED.csv", d3.autoType));
// drawStack(await d3.csv("dataset/vgchartz_3d_FILTERED.csv", d3.autoType));
