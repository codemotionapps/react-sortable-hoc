/* eslint eol-last: ["error", "always"] */

const { clamp } = require(`../utils`);

function distanceRect(x, y, rect){
	const dx = x - clamp(x, rect.left, rect.right);
	const dy = y - clamp(y, rect.top, rect.bottom);

	return Math.sqrt((dx * dx) + (dy * dy));
}

export function closestRect(x, y, containers){
	const distances = containers.map(c =>
		distanceRect(x, y, c.getBoundingClientRect()));
	return distances.indexOf(Math.min(...distances));
}

function getDelta(rect1, rect2){
	return {
		x: rect1.left - rect2.left,
		y: rect1.top - rect2.top
	};
}

export function updateDistanceBetweenContainers(distance, container1, container2){
	const {x, y} = distance;
	const d = getDelta(
		...[container1, container2].map(c => c.container.getBoundingClientRect()),
	);
	const scrollDX = container2.scrollContainer.scrollLeft - container1.scrollContainer.scrollLeft;
	const scrollDY = do{
		if(container2.scrollContainer.scrollTop > container1.scrollContainer.scrollTop){
			container2.scrollContainer.scrollTop - container1.scrollContainer.scrollTop;
		}else{
			container1.scrollContainer.scrollTop - container2.scrollContainer.scrollTop;
		}
	};
	return {
		x: x + d.x + scrollDX,
		y: y + d.y + scrollDY
	};
}

export const getCoordinates = (element, list) => {
	const rectangle = element.getBoundingClientRect();
	return {
		x: rectangle.left + list.scrollContainer.scrollLeft,
		y: rectangle.top + list.scrollContainer.scrollTop
	};
};

export function padding(style, axis){
	return do {
		if(axis === `x`){
			style.paddingLeft + style.paddingRight;
		}else{
			style.paddingTop + style.paddingBottom;
		}
	};
}
