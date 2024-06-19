async function fetchData() {
    const data = await d3.csv('data.csv');
    return data;
}

function transformData(data) {
    const root = { name: 'root', children: [] };
    data.forEach(item => {
        const parts = item.name.split('^');
        let currentNode = root;
        parts.forEach((part, index) => {
            let childNode = currentNode.children.find(child => child.name === part);
            if (!childNode) {
                childNode = { name: part, children: [] };
                if (index === parts.length - 1) {
                    childNode.value = +item.value;
                }
                currentNode.children.push(childNode);
            }
            currentNode = childNode;
        });
    });
    return root;
}

async function createSunburstChart() {
    const data = await fetchData();
    const root = transformData(data);

    const width = 932;
    const radius = width / 2;

    const partition = d3.partition()
        .size([2 * Math.PI, radius]);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius / 2)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1 - 1);

    const rootHierarchy = d3.hierarchy(root)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

    partition(rootHierarchy);

    const svg = d3.create("svg")
        .attr("viewBox", [0, 0, width, width])
        .style("font", "10px sans-serif");

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip");

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${width / 2})`);

    g.selectAll("path")
        .data(rootHierarchy.descendants().slice(1))
        .join("path")
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return d3.color("steelblue"); })
        .attr("d", arc)
        .on("mouseover", function (event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(d.data.name)
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function (event, d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", clicked);

    function clicked(event, p) {
        rootHierarchy.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = g.transition().duration(750);

        g.selectAll("path")
            .transition(t)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function (d) {
                return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
            .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
            .attrTween("d", d => () => arc(d.current));
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    document.getElementById('chart').appendChild(svg.node());
}

createSunburstChart();
