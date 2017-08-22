/* eslint eol-last: ["error", "always"] */

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

export function clamp(value, min, max){
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

export function dragComponentSize(node, axis, marginOffset, next){
	const sizeAttribute = attribute(`offset`, axis);

	const size = node[sizeAttribute] + marginOffset;
	return size * next / 2;
}

export function cleanTranform(array){
	if(array && array.length){
		let element;
		while(element = array.pop()){
			element.style.transform = ``;
		}
	}
}

export function attribute(attr, axis){
	switch(attr){
		case `scroll`:
			return axis === `x` ? `scrollLeft` : `scrollTop`;
		case `offset`:
			return axis === `x` ? `offsetWidth` : `offsetHeight`;
		case `size`:
			return axis === `x` ? `width` : `height`;
	}
}
