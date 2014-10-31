/*
* Commons functions usefull accros the app
*/

exports.encodeTime =function(id) {
	var now = new Date();
	var dateField = [now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()];
	if (id) 
		dateField.splice(0, 0, id);
	
	return dateField.map(function(val) {
		return {
			numericType: 'U8',
			numericValue: val
		};
	});
}