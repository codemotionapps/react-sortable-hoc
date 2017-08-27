/* eslint eol-last: ["error", "always"] */

const { clamp, getCSSPixelValue } = require(`../utils`);

const ClientRect = document.body.getBoundingClientRect().constructor;

function distanceRect(x, y, rect){
	const dx = x - clamp(x, rect.left, rect.right);
	const dy = y - clamp(y, rect.top, rect.bottom);

	return Math.sqrt((dx * dx) + (dy * dy));
}

export function closestRect(x, y, containers){
	const distances = containers.map(c => distanceRect(x, y, c.getBoundingClientRect()));
	return distances.indexOf(Math.min(...distances));
}

export function getCoordinate(element, axis){ // Margin not included
	const rect = element.getBoundingClientRect();
	return do {
		if(axis === `x`){
			rect.left + (rect.width / 2);
		}else{
			rect.top + (rect.height / 2);
		}
	};
}

export function closestNode(coordinates, nodes, axis){
	const [a, b] = coordinates;
	const distances = nodes.map(c => (
		c = getCoordinate(c, axis),
		Math.min(a - c, b - c)
	));

	if(distances.length === 0) return 0;

	return distances.indexOf(distances.reduce(
		(prev, curr) => Math.abs(curr) < Math.abs(prev) ? curr : prev
	));
}

export function getHelperBoundaries(node, axis){
	const rect = node.getBoundingClientRect();
	return do {
		if(axis === `x`){
			[rect.left, rect.left + rect.width];
		}else{
			[rect.top, rect.top + rect.height];
		}
	};
}

export function getCoordinates(element, list, axis){
	if(element.constructor !== ClientRect) element = element.getBoundingClientRect();
	return do {
		if(axis === `x`){
			element.left + list.scrollContainer.scrollLeft;
		}else{
			element.top + list.scrollContainer.scrollTop;
		}
	};
};

export function padding(style, axis){
	return do {
		if(axis === `x`){
			getCSSPixelValue(style.paddingLeft) + getCSSPixelValue(style.paddingRight);
		}else{
			getCSSPixelValue(style.paddingTop) + getCSSPixelValue(style.paddingBottom);
		}
	};
}
