let globalFilters = new Map();
const svg = d3.select("svg#stack");
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

const transitionDuration = 300;

const filterData = async function (colorScale = null) {
	// Load in the dataset
	let data = await d3.csv("dataset/vgchartz_3d_FILTERED.csv", d3.autoType);

	// Filter the data according to the selected filters
	const conSelections = globalFilters.get("console");
	const devSelections = globalFilters.get("developer");
	const genSelections = globalFilters.get("genre");
	const conFiltered = data.filter((d) => conSelections.has(d["console"]));
	const devFiltered = data.filter((d) => devSelections.has(d["developer"]));
	const genFiltered = data.filter((d) => genSelections.has(d["genre"]));

	const filtered = [...conFiltered, ...devFiltered, ...genFiltered];

	if (devFiltered.length && conFiltered.length) {
		data = Array.from(d3.intersection(conFiltered, devFiltered));
		if (genFiltered.length) {
			data = Array.from(d3.intersection(data, genFiltered));
		}
	} else if (devFiltered.length || conFiltered.length) {
		data = [...conFiltered, ...devFiltered];
		if (genFiltered.length) {
			data = Array.from(d3.intersection(data, genFiltered));
		}
	} else if (genFiltered.length) {
		data = Array.from(d3.intersection(data, genFiltered));
	}

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
	const color = colorScale
		? colorScale
		: d3.scaleOrdinal(mygroups, [...d3.schemeSet1, ...d3.schemeSet3]);

	drawStack(grouped, mygroups, color);
};

const drawStack = function (grouped, mygroups, color) {
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

	// Append axes and gridlines or update them if they already exist
	if (d3.selectAll(".annotations").empty()) {
		annotations
			.append("g")
			.attr("class", "x axis annotations")
			.attr("transform", `translate(0, ${chartHeight})`)
			.call(d3.axisBottom(x).ticks(grouped.size, "d"))
			.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.5em")
			.attr("dy", ".25em")
			.attr("transform", "rotate(-65)")
			.style("opacity", 0)
			.transition()
			.duration(transitionDuration)
			.style("opacity", 1);
		annotations
			.append("g")
			.attr("class", "y axis annotations")
			.style("opacity", 0)
			.call(d3.axisLeft(y))
			.call((d) => d.select(".domain").remove())
			.transition()
			.duration(transitionDuration)
			.style("opacity", 1);
		annotations
			.append("g")
			.attr("class", "y grid annotations")
			.style("opacity", 0)
			.call(d3.axisLeft(y).tickSize(-chartWidth).tickFormat(""))
			.call((d) => d.select(".domain").remove())
			.transition()
			.duration(transitionDuration)
			.style("opacity", 0.3);
	} else {
		d3.selectAll(".x.axis")
			.transition()
			.duration(transitionDuration)
			.call(d3.axisBottom(x).ticks(grouped.size, "d"))
			.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.5em")
			.attr("dy", ".25em")
			.attr("transform", "rotate(-65)");
		d3.selectAll(".y.axis")
			.transition()
			.duration(transitionDuration)
			.call(d3.axisLeft(y));
		d3.selectAll(".y.grid")
			.transition()
			.duration(transitionDuration)
			.call(d3.axisLeft(y).tickSize(-chartWidth).tickFormat(""));
	}

	let area = d3
		.area()
		.x((d) => x(d.data[0]))
		.y0((d) => y(d[0]))
		.y1((d) => y(d[1]));

	// Create, draw, and color the areas and clear chartArea
	async function removePaths() {
		await new Promise(() => {
			chartArea.select("*").transition().duration(transitionDuration).remove();
		});
	}

	async function createPaths() {
		await new Promise((resolve) => {
			chartArea
				.selectAll("path.layer")
				.data(stackedData)
				.join("path")
				.attr("class", "layer")
				.on("click", function (ev, d) {
					const datum = d3.select(this).datum();
					const thisGenre = stackedData.find((d) => d === datum).key;
					const genreFilters = globalFilters.get("genre");
					genreText.text("");
					lifetimeSalesText.text("");
					if (genreFilters.has(thisGenre)) {
						genreFilters.delete(thisGenre);
					} else {
						genreFilters.add(thisGenre);
					}
					filterData(color);
				})
				.on("mouseover", mouseIn)
				.on("mouseout", mouseOut)
				.attr("d", area)
				.style("opacity", 0)
				.transition()
				.duration(transitionDuration)
				.style("opacity", 1)
				.attr("fill", (d) => color(d.key))
				.style("cursor", "pointer");
		});
	}

	async function runTasks() {
		await Promise.all([removePaths(), createPaths()]);
	}
	runTasks();

	const previewContainer = d3.select("#stack-preview-cont");

	if (d3.select(".preview").empty()) {
		const genreText = previewContainer
			.append("p")
			.attr("class", "tooltip preview genre")
			.attr("text-anchor", "middle")
			.attr("alignment-baseline", "hanging")
			.text("Genre: ")
			.style("visibility", "hidden");

		const lifetimeSalesText = previewContainer
			.append("p")
			.attr("class", "tooltip preview sales")
			.attr("text-anchor", "middle")
			.attr("alignment-baseline", "hanging")
			.text("Lifetime Sales: ")
			.style("visibility", "hidden");

		previewContainer
			.append("svg")
			.attr("class", "preview")
			.attr("id", "stack-legend")
			.attr("width", 506)
			.attr("height", "193");
	}
	const genreText = previewContainer.select(".tooltip.preview.genre");
	const lifetimeSalesText = previewContainer.select(".tooltip.preview.sales");

	// color.domain().includes(mygroups);

	drawLegend("#stack-legend", color);

	function mouseIn(ev) {
		genreText.text("").style("visibility", "visible");
		lifetimeSalesText.text("").style("visibility", "visible");
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
		genreText.style("visibility", "hidden");
		lifetimeSalesText.style("visibility", "hidden");
		d3.select(this).style("stroke", "none");
		d3.selectAll("path.layer").style("opacity", 1);
	}
};

const createFilters = function (data) {
	const aggregatedData = d3
		.flatRollup(
			data,
			(v) => d3.sum(v, (d) => +d.total_sales),
			(d) => d.release_date.getFullYear(),
			(d) => d.genre
		)
		.map(([year, genre, total_sales]) => ({ year, genre, total_sales }))
		.sort((a, b) => d3.ascending(a.year, b.year));

	const mygroups = [...d3.group(aggregatedData, (d) => d.genre).keys()];

	const color = d3.scaleOrdinal(mygroups, [...d3.schemeSet1, ...d3.schemeSet3]);

	const conFilters = d3
		.rollups(
			data,
			(v) => d3.sum(v, (d) => +d.total_sales),
			(d) => d.console
		)
		.sort((a, b) => d3.descending(a[1], b[1]))
		.map(([console]) => console)
		.slice(0, 10);

	const devFilters = d3
		.rollups(
			data,
			(v) => d3.sum(v, (d) => +d.total_sales),
			(d) => d.developer
		)
		.sort((a, b) => d3.descending(a[1], b[1]))
		.map(([developer]) => developer)
		.slice(0, 10);

	const filterKeys = ["console", "developer"];

	globalFilters.set("console", new Set());
	globalFilters.set("developer", new Set());
	globalFilters.set("genre", new Set());

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
			filterData(color);
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
			filterData(color);
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

	filterData(color);
};

createFilters(await d3.csv("dataset/vgchartz_3d_FILTERED.csv", d3.autoType));
