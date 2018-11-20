import React from 'react';

function getNode(ref){
	ref && (ref.sortableHandle = true);
}

export default function SortableHandle(props){
	const { component: Component, getComponentRef } = props;
	return <Component getNode={getNode} ref={getComponentRef} {...props} />;
}