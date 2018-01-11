/* eslint eol-last: ["error", "always"] */

const ClientRect = document.body.getBoundingClientRect().constructor;

export function arrayMove(arr, previousIndex, newIndex){
	const array = arr.slice(0);
	if(newIndex === -1){
		array.splice(previousIndex, 1);
	}else{
		if(newIndex >= array.length){
			let k = newIndex - array.length;
			while(k-- + 1){
				array.push(undefined);
			}
		}
		array.splice(newIndex, 0, array.splice(previousIndex, 1)[0]);
	}
	return array;
}

export function arrayInsert(arr, index, item){
	const array = arr.slice(0);
	array.splice(index, 0, item);
	return array;
}

export function omit(obj, keysToOmit){
	return Object.keys(obj).reduce((acc, key) => {
		if(keysToOmit.indexOf(key) === -1) acc[key] = obj[key];
		return acc;
	}, {});
}

// export const events = { // With touch
// 	start: ['touchstart', 'mousedown'],
// 	move: ['touchmove', 'mousemove'],
// 	end: ['touchend', 'touchcancel', 'mouseup']
// };

export const events = {
	start: [`mousedown`],
	move: [`mousemove`],
	end: [`mouseup`]
};

export function getOffset(e){
	const event = e.touches ? e.touches[0] : e;
	return {
		x: event.clientX,
		y: event.clientY,
		pageX: event.pageX,
		pageY: event.pageY
	};
}

export function closest(el, fn){
	while(el){
		if(fn(el)) return el;
		el = el.parentNode;
	}
}

function clamp(value, min, max){
	if(value < min){
		return min;
	}
	if(value > max){
		return max;
	}
	return value;
}

export function getCSSPixelValue(stringValue){
	if(stringValue.substr(-2) === `px`){
		return parseFloat(stringValue);
	}
	return 0;
}

export function getElementMargin(element){
	const style = window.getComputedStyle(element);

	return {
		top: getCSSPixelValue(style.marginTop),
		right: getCSSPixelValue(style.marginRight),
		bottom: getCSSPixelValue(style.marginBottom),
		left: getCSSPixelValue(style.marginLeft)
	};
}

export const attributes = {
	scroll: {
		x: `scrollLeft`,
		y: `scrollTop`
	},
	offset: {
		x: `offsetWidth`,
		y: `offsetHeight`
	},
	size: {
		x: `width`,
		y: `height`
	},
	coordinate: {
		x: `left`,
		y: `top`
	}
};

export function dragComponentSize(node, axis, marginOffset, next){
	const sizeAttribute = attributes.offset[axis];

	const size = node[sizeAttribute] + marginOffset;
	return size * next / 2;
}

export function cleanTransform(array, nodes: Object){
	if(array && array.length){
		let item;
		while(item = array.pop()){
			const node = nodes[item.index];
			node && (node.style.transform = ``);
		}
	}
}

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
	const distances = nodes.map((node, index) => {
		const diff = getCoordinate(node, axis);
		return {
			diff: Math.min(a - diff, b - diff),
			index,
			node
		};
	});

	if(distances.length === 0) return 0;

	return distances.reduce((prev, curr) =>
		Math.abs(curr.diff) < Math.abs(prev.diff) ? curr : prev
	);
}

export function getHelperBoundaries(node, axis){
	const rect = node.getBoundingClientRect();
	return do {
		if(axis === `x`){
			[rect.left, rect.left + rect.width, rect.width];
		}else{
			[rect.top, rect.top + rect.height, rect.height];
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
}

export function isScrollable(element){
	return element.offsetHeight !== element.scrollHeight;
}

export function arrayLast(array){
	return array[array.length - 1];
}
