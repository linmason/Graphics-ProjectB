//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// BasicShapes.js  MODIFIED for EECS 351-1, 
//									Northwestern Univ. Jack Tumblin
//		--converted from 2D to 4D (x,y,z,w) vertices
//		--extend to other attributes: color, surface normal, etc.
//		--demonstrate how to keep & use MULTIPLE colored shapes in just one
//			Vertex Buffer Object(VBO). 
//		--create several canonical 3D shapes borrowed from 'GLUT' library:
//		--Demonstrate how to make a 'stepped spiral' tri-strip,  and use it
//			to build a cylinder, sphere, and torus.


// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
  'uniform mat4 u_ModelMatrix;\n' +
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_ModelMatrix * a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 
//  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
//  '#endif GL_ES\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

// Global Variables
var g_canvas = document.getElementById('webgl');  // Retrieve HTML <canvas> element
var g_strafeTranslate = 0;
var g_lookatTranslate = 0;
var g_theta = 0;
var g_thetaRate = 0;
var g_zOffset = 0;
var g_zOffsetRate = 0;

var ANGLE_STEP = 45.0;		// Rotation angle rate (degrees/second)
var floatsPerVertex = 7;	// # of Float32Array elements used for each vertex
													// (x,y,z,w)position + (r,g,b)color
													// Later, see if you can add:
													// (x,y,z) surface normal + (tx,ty) texture addr.
var g_angle01 = 0;
var g_angle01Rate = 100;
var g_angle01min = -180;
var g_angle01max = 180;

//------------For mouse click-and-drag: -------------------------------
var g_isDrag=false;		// mouse-drag: true when user holds down mouse button
var g_xMclik=0.0;			// last mouse button-down position (in CVV coords)
var g_yMclik=0.0;   
var g_xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var g_yMdragTot=0.0;  


function main() {
//==============================================================================
	// Retrieve <canvas> element
	var canvas = document.getElementById('webgl');

	// Get the rendering context for WebGL
	var gl = getWebGLContext(canvas);
	if (!gl) {
	console.log('Failed to get the rendering context for WebGL');
	return;
	}

	// Initialize shaders
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
	console.log('Failed to intialize shaders.');
	return;
	}

	//  Initialize vertex buffer
	var n = initVertexBuffer(gl);
	if (n < 0) {
		console.log('Failed to set the vertex information');
		return;
	}

	// add event listeners
	window.addEventListener("keydown", myKeyDown, false);
	window.addEventListener("keyup", myKeyUp, false);
	window.addEventListener("mousedown", myMouseDown);
	window.addEventListener("mousemove", myMouseMove); 
	window.addEventListener("mouseup", myMouseUp);	
	window.addEventListener("click", myMouseClick);				
	window.addEventListener("dblclick", myMouseDblClick); 

	// Specify the color for clearing <canvas>
	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	// Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// unless the new Z value is closer to the eye than the old one..
	gl.enable(gl.DEPTH_TEST); 	 

	// Get handle to graphics system's storage location of u_ModelMatrix
	var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	if (!u_ModelMatrix) { 
		console.log('Failed to get the storage location of u_ModelMatrix');
		return;
	}

	// Create a local version of our model matrix in JavaScript 
	var modelMatrix = new Matrix4();

	// Create, init current rotation angle value in JavaScript
	var currentAngle = 0.0;

	// Initialize eye position
	var eye_position = [1, 0, 1];

	// Initialize look at position
	var lookat_position = [1, 1, 1];

	// Initialize optical_source for quaternion rotation
	//var opt_src = [1, 1, 1]; //or it might be closer to lookat_position - eye_position;

	// Start drawing: create 'tick' variable whose value is this function:
	var tick = function() {
		// get lookat and eye positions
		updateCameraPositions(eye_position, lookat_position);
		currentAngle = animate(currentAngle);  // Update the rotation angle
		drawAll(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position);   // Draw shapes
		// report current angle on console
		//console.log('currentAngle=',currentAngle);
		requestAnimationFrame(tick, canvas);  // Request that the browser re-draw the webpage
	};

	// Resize the image on load
	resizeCanvas();

	// Start (and continue) animation: draw current image
	tick();
}

function initVertexBuffer(gl) {
//==============================================================================
// Create one giant vertex buffer object (VBO) that holds all vertices for all
// shapes.
 
 	// Make each 3D shape in its own array of vertices:
	makeCylinder();					// create, fill the cylVerts array
	makeSphere();						// create, fill the sphVerts array
	makeTorus();						// create, fill the torVerts array
	makeGroundGrid();				// create, fill the gndVerts array
	makeHouse();
	makeDiamond();
	makePyramid();
	makeAxes();
	  
	// how many floats total needed to store all shapes?
	var mySiz = (cylVerts.length + sphVerts.length + 
							 torVerts.length + gndVerts.length + houseVerts.length + diamondVerts.length
							 + pyramidVerts.length + axesVerts.length);						

	// How many vertices total?
	var nn = mySiz / floatsPerVertex;
	console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex);
	// Copy all shapes into one big Float32 array:
  	var colorShapes = new Float32Array(mySiz);
	// Copy them:  remember where to start for each shape:
	cylStart = 0;							// we stored the cylinder first.
  	for(i=0,j=0; j< cylVerts.length; i++,j++) {
  		colorShapes[i] = cylVerts[j];
		}
	
	sphStart = i;						// next, we'll store the sphere;
	for(j=0; j< sphVerts.length; i++, j++) {// don't initialize i -- reuse it!
		colorShapes[i] = sphVerts[j];
		}
	
	torStart = i;						// next, we'll store the torus;
	for(j=0; j< torVerts.length; i++, j++) {
		colorShapes[i] = torVerts[j];
		}
	
	gndStart = i;						// next we'll store the ground-plane;
	for(j=0; j< gndVerts.length; i++, j++) {
		colorShapes[i] = gndVerts[j];
		}

	houseStart = i;						// next we'll store the ground-plane;
	for(j=0; j< houseVerts.length; i++, j++) {
		colorShapes[i] = houseVerts[j];
		}

	diamondStart = i;						// next we'll store the ground-plane;
	for(j=0; j< diamondVerts.length; i++, j++) {
		colorShapes[i] = diamondVerts[j];
		}

	pyramidStart = i;						// next we'll store the ground-plane;
	for(j=0; j< pyramidVerts.length; i++, j++) {
		colorShapes[i] = pyramidVerts[j];
		}
		
	axesStart = i;						// next we'll store the ground-plane;
	for(j=0; j< axesVerts.length; i++, j++) {
		colorShapes[i] = axesVerts[j];
		}


	// Create a buffer object on the graphics hardware:
	var shapeBufferHandle = gl.createBuffer();  
	if (!shapeBufferHandle) {
		console.log('Failed to create the shape buffer object');
		return false;
	}

	// Bind the the buffer object to target:
	gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
	// Transfer data from Javascript array colorShapes to Graphics system VBO
	// (Use sparingly--may be slow if you transfer large shapes stored in files)
	gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);
    
	//Get graphics system's handle for our Vertex Shader's position-input variable: 
	var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
	if (a_Position < 0) {
		console.log('Failed to get the storage location of a_Position');
		return -1;
	}

	var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?

	// Use handle to specify how to retrieve **POSITION** data from our VBO:
	gl.vertexAttribPointer(
			a_Position, 	// choose Vertex Shader attribute to fill with data
			4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
			gl.FLOAT, 		// data type for each value: usually gl.FLOAT
			false, 				// did we supply fixed-point data AND it needs normalizing?
			FSIZE * floatsPerVertex, // Stride -- how many bytes used to store each vertex?
										// (x,y,z,w, r,g,b) * bytes/value
			0);						// Offset -- now many bytes from START of buffer to the
										// value we will actually use?
	gl.enableVertexAttribArray(a_Position);  
  									// Enable assignment of vertex buffer object's position data

	// Get graphics system's handle for our Vertex Shader's color-input variable;
	var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
	if(a_Color < 0) {
		console.log('Failed to get the storage location of a_Color');
		return -1;
	}
	// Use handle to specify how to retrieve **COLOR** data from our VBO:
	gl.vertexAttribPointer(
		a_Color, 				// choose Vertex Shader attribute to fill with data
		3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
		gl.FLOAT, 			// data type for each value: usually gl.FLOAT
		false, 					// did we supply fixed-point data AND it needs normalizing?
		FSIZE * 7, 			// Stride -- how many bytes used to store each vertex?
										// (x,y,z,w, r,g,b) * bytes/value
		FSIZE * 4);			// Offset -- how many bytes from START of buffer to the
										// value we will actually use?  Need to skip over x,y,z,w
										
	gl.enableVertexAttribArray(a_Color);  
										// Enable assignment of vertex buffer object's position data

	//--------------------------------DONE!
  	// Unbind the buffer object 
  	gl.bindBuffer(gl.ARRAY_BUFFER, null);

  	return nn;
}

// simple & quick-- 
// I didn't use any arguments such as color choices, # of verts,slices,bars, etc.
// YOU can improve these functions to accept useful arguments...
//
function makeDiamond() {
//==============================================================================
// Make a diamond-like shape from two adjacent tetrahedra, aligned with Z axis.
diamondVerts = new Float32Array([

// Triangle 1
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 2 
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 3
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4

	// Triangle 4
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3

	// Triangle 5
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 6
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 7
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4

	// Triangle 8
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3

])
	// YOU write this one...
	
}

function makeHouse() {
houseVerts = new Float32Array([ 
	// Triangle 1
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B

     // Triangle 2
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B

     // Triangle 3
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 4
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 5
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H

     // Triangle 6
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H

     // Triangle 7
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D

     // Triangle 8
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D

     // Triangle 9
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 10
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 11
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E

     // Triangle 12
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E

     // Triangle 13
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E

     // Triangle 14
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E
])

}

function makePyramid() {
//==============================================================================
// Make a 4-cornered pyramid from one OpenGL TRIANGLE_STRIP primitive.
// All vertex coords are +/1 or zero; pyramid base is in xy plane. 
/*
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3
	*/
pyramidVerts = new Float32Array([ 
	//Triangle 1
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2

	//Triangle 2
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3

	//Triangle 3
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3

	//Triangle 4
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3
])

  	// YOU write this one...
}


function makeCylinder() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
//
	var ctrColr = new Float32Array([0.2, 0.2, 0.2]);	// dark gray
	var topColr = new Float32Array([0.4, 0.7, 0.4]);	// light green
	var botColr = new Float32Array([0.5, 0.5, 1.0]);	// light blue
	var capVerts = 16;	// # of vertices around the topmost 'cap' of the shape
	var botRadius = 1.6;		// radius of bottom of cylinder (top always 1.0)
	
	// Create a (global) array to hold this cylinder's vertices;
	cylVerts = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);  // # of vertices * # of elements needed to store them. 

	// Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
	// v counts vertices: j counts array elements (vertices * elements per vertex)
	for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {	
		// skip the first vertex--not needed.
		if(v%2==0)
		{				// put even# vertices at center of cylinder's top cap:
			cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,1,1
			cylVerts[j+1] = 0.0;	
			cylVerts[j+2] = 1.0; 
			cylVerts[j+3] = 1.0;			// r,g,b = topColr[]
			cylVerts[j+4]=ctrColr[0]; 
			cylVerts[j+5]=ctrColr[1]; 
			cylVerts[j+6]=ctrColr[2];
		}
		else { 	// put odd# vertices around the top cap's outer edge;
						// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
						// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
			cylVerts[j  ] = Math.cos(Math.PI*(v-1)/capVerts);			// x
			cylVerts[j+1] = Math.sin(Math.PI*(v-1)/capVerts);			// y
			//	(Why not 2*PI? because 0 < =v < 2*capVerts, so we
			//	 can simplify cos(2*PI * (v-1)/(2*capVerts))
			cylVerts[j+2] = 1.0;	// z
			cylVerts[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts[j+4]=topColr[0]; 
			cylVerts[j+5]=topColr[1]; 
			cylVerts[j+6]=topColr[2];			
		}
	}
	// Create the cylinder side walls, made of 2*capVerts vertices.
	// v counts vertices within the wall; j continues to count array elements
	for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
		if(v%2==0)	// position all even# vertices along top cap:
		{		
				cylVerts[j  ] = Math.cos(Math.PI*(v)/capVerts);		// x
				cylVerts[j+1] = Math.sin(Math.PI*(v)/capVerts);		// y
				cylVerts[j+2] = 1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=topColr[0]; 
				cylVerts[j+5]=topColr[1]; 
				cylVerts[j+6]=topColr[2];			
		}
		else		// position all odd# vertices along the bottom cap:
		{
				cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);		// x
				cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);		// y
				cylVerts[j+2] =-1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=botColr[0]; 
				cylVerts[j+5]=botColr[1]; 
				cylVerts[j+6]=botColr[2];			
		}
	}
	// Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
	// v counts the vertices in the cap; j continues to count array elements
	for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
		if(v%2==0) {	// position even #'d vertices around bot cap's outer edge
			cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);		// x
			cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v)/capVerts);		// y
			cylVerts[j+2] =-1.0;	// z
			cylVerts[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts[j+4]=botColr[0]; 
			cylVerts[j+5]=botColr[1]; 
			cylVerts[j+6]=botColr[2];		
		}
		else {				// position odd#'d vertices at center of the bottom cap:
			cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,-1,1
			cylVerts[j+1] = 0.0;	
			cylVerts[j+2] =-1.0; 
			cylVerts[j+3] = 1.0;			// r,g,b = botColr[]
			cylVerts[j+4]=botColr[0]; 
			cylVerts[j+5]=botColr[1]; 
			cylVerts[j+6]=botColr[2];
		}
	}
}

function makeSphere() {
//==============================================================================
// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   Make ring-like 
// equal-lattitude 'slices' of the sphere (bounded by planes of constant z), 
// and connect them as a 'stepped spiral' design (see makeCylinder) to build the
// sphere from one triangle strip.
	var slices = 13;		// # of slices of the sphere along the z axis. >=3 req'd
												// (choose odd # or prime# to avoid accidental symmetry)
	var sliceVerts	= 27;	// # of vertices around the top edge of the slice
												// (same number of vertices on bottom of slice, too)
	var topColr = new Float32Array([0.7, 0.7, 0.7]);	// North Pole: light gray
	var equColr = new Float32Array([0.3, 0.7, 0.3]);	// Equator:    bright green
	var botColr = new Float32Array([0.9, 0.9, 0.9]);	// South Pole: brightest gray.
	var sliceAngle = Math.PI/slices;	// lattitude angle spanned by one slice.

		// Create a (global) array to hold this sphere's vertices:
	sphVerts = new Float32Array(  ((slices * 2* sliceVerts) -2) * floatsPerVertex);
											// # of vertices * # of elements needed to store them. 
											// each slice requires 2*sliceVerts vertices except 1st and
											// last ones, which require only 2*sliceVerts-1.
										
	// Create dome-shaped top slice of sphere at z=+1
	// s counts slices; v counts vertices; 
	// j counts array elements (vertices * elements per vertex)
	var cos0 = 0.0;					// sines,cosines of slice's top, bottom edge.
	var sin0 = 0.0;
	var cos1 = 0.0;
	var sin1 = 0.0;	
	var j = 0;							// initialize our array index
	var isLast = 0;
	var isFirst = 1;
	for(s=0; s<slices; s++) {	// for each slice of the sphere,
		// find sines & cosines for top and bottom of this slice
		if(s==0) {
			isFirst = 1;	// skip 1st vertex of 1st slice.
			cos0 = 1.0; 	// initialize: start at north pole.
			sin0 = 0.0;
		}
		else {					// otherwise, new top edge == old bottom edge
			isFirst = 0;	
			cos0 = cos1;
			sin0 = sin1;
		}								// & compute sine,cosine for new bottom edge.
		cos1 = Math.cos((s+1)*sliceAngle);
		sin1 = Math.sin((s+1)*sliceAngle);
		// go around the entire slice, generating TRIANGLE_STRIP verts
		// (Note we don't initialize j; grows with each new attrib,vertex, and slice)
		if(s==slices-1) isLast=1;	// skip last vertex of last slice.
		for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=floatsPerVertex) {	
			if(v%2==0)
			{				// put even# vertices at the the slice's top edge
							// (why PI and not 2*PI? because 0 <= v < 2*sliceVerts
							// and thus we can simplify cos(2*PI(v/2*sliceVerts))  
				sphVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts); 	
				sphVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);	
				sphVerts[j+2] = cos0;		
				sphVerts[j+3] = 1.0;			
			}
			else { 	// put odd# vertices around the slice's lower edge;
							// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
							// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
				sphVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);		// x
				sphVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);		// y
				sphVerts[j+2] = cos1;																				// z
				sphVerts[j+3] = 1.0;																				// w.		
			}
			if(s==0) {	// finally, set some interesting colors for vertices:
				sphVerts[j+4]=topColr[0]; 
				sphVerts[j+5]=topColr[1]; 
				sphVerts[j+6]=topColr[2];	
				}
			else if(s==slices-1) {
				sphVerts[j+4]=botColr[0]; 
				sphVerts[j+5]=botColr[1]; 
				sphVerts[j+6]=botColr[2];	
			}
			else {
					sphVerts[j+4]=Math.random();// equColr[0]; 
					sphVerts[j+5]=Math.random();// equColr[1]; 
					sphVerts[j+6]=Math.random();// equColr[2];					
			}
		}
	}
}

function makeTorus() {
//==============================================================================
// 		Create a torus centered at the origin that circles the z axis.  
// Terminology: imagine a torus as a flexible, cylinder-shaped bar or rod bent 
// into a circle around the z-axis. The bent bar's centerline forms a circle
// entirely in the z=0 plane, centered at the origin, with radius 'rbend'.  The 
// bent-bar circle begins at (rbend,0,0), increases in +y direction to circle  
// around the z-axis in counter-clockwise (CCW) direction, consistent with our
// right-handed coordinate system.
// 		This bent bar forms a torus because the bar itself has a circular cross-
// section with radius 'rbar' and angle 'phi'. We measure phi in CCW direction 
// around the bar's centerline, circling right-handed along the direction 
// forward from the bar's start at theta=0 towards its end at theta=2PI.
// 		THUS theta=0, phi=0 selects the torus surface point (rbend+rbar,0,0);
// a slight increase in phi moves that point in -z direction and a slight
// increase in theta moves that point in the +y direction.  
// To construct the torus, begin with the circle at the start of the bar:
//					xc = rbend + rbar*cos(phi); 
//					yc = 0; 
//					zc = -rbar*sin(phi);			(note negative sin(); right-handed phi)
// and then rotate this circle around the z-axis by angle theta:
//					x = xc*cos(theta) - yc*sin(theta) 	
//					y = xc*sin(theta) + yc*cos(theta)
//					z = zc
// Simplify: yc==0, so
//					x = (rbend + rbar*cos(phi))*cos(theta)
//					y = (rbend + rbar*cos(phi))*sin(theta) 
//					z = -rbar*sin(phi)
// To construct a torus from a single triangle-strip, make a 'stepped spiral' 
// along the length of the bent bar; successive rings of constant-theta, using 
// the same design used for cylinder walls in 'makeCyl()' and for 'slices' in 
// makeSphere().  Unlike the cylinder and sphere, we have no 'special case' 
// for the first and last of these bar-encircling rings.
//
var rbend = 1.0;										// Radius of circle formed by torus' bent bar
var rbar = 0.5;											// radius of the bar we bent to form torus
var barSlices = 23;									// # of bar-segments in the torus: >=3 req'd;
																		// more segments for more-circular torus
var barSides = 13;										// # of sides of the bar (and thus the 
																		// number of vertices in its cross-section)
																		// >=3 req'd;
																		// more sides for more-circular cross-section
// for nice-looking torus with approx square facets, 
//			--choose odd or prime#  for barSides, and
//			--choose pdd or prime# for barSlices of approx. barSides *(rbend/rbar)
// EXAMPLE: rbend = 1, rbar = 0.5, barSlices =23, barSides = 11.

	// Create a (global) array to hold this torus's vertices:
 torVerts = new Float32Array(floatsPerVertex*(2*barSides*barSlices +2));
//	Each slice requires 2*barSides vertices, but 1st slice will skip its first 
// triangle and last slice will skip its last triangle. To 'close' the torus,
// repeat the first 2 vertices at the end of the triangle-strip.  Assume 7

var phi=0, theta=0;										// begin torus at angles 0,0
var thetaStep = 2*Math.PI/barSlices;	// theta angle between each bar segment
var phiHalfStep = Math.PI/barSides;		// half-phi angle between each side of bar
																			// (WHY HALF? 2 vertices per step in phi)
	// s counts slices of the bar; v counts vertices within one slice; j counts
	// array elements (Float32) (vertices*#attribs/vertex) put in torVerts array.
	for(s=0,j=0; s<barSlices; s++) {		// for each 'slice' or 'ring' of the torus:
		for(v=0; v< 2*barSides; v++, j+=7) {		// for each vertex in this slice:
			if(v%2==0)	{	// even #'d vertices at bottom of slice,
				torVerts[j  ] = (rbend + rbar*Math.cos((v)*phiHalfStep)) * 
																						 Math.cos((s)*thetaStep);
							  //	x = (rbend + rbar*cos(phi)) * cos(theta)
				torVerts[j+1] = (rbend + rbar*Math.cos((v)*phiHalfStep)) *
																						 Math.sin((s)*thetaStep);
								//  y = (rbend + rbar*cos(phi)) * sin(theta) 
				torVerts[j+2] = -rbar*Math.sin((v)*phiHalfStep);
								//  z = -rbar  *   sin(phi)
				torVerts[j+3] = 1.0;		// w
			}
			else {				// odd #'d vertices at top of slice (s+1);
										// at same phi used at bottom of slice (v-1)
				torVerts[j  ] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) * 
																						 Math.cos((s+1)*thetaStep);
							  //	x = (rbend + rbar*cos(phi)) * cos(theta)
				torVerts[j+1] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) *
																						 Math.sin((s+1)*thetaStep);
								//  y = (rbend + rbar*cos(phi)) * sin(theta) 
				torVerts[j+2] = -rbar*Math.sin((v-1)*phiHalfStep);
								//  z = -rbar  *   sin(phi)
				torVerts[j+3] = 1.0;		// w
			}
			torVerts[j+4] = Math.random();		// random color 0.0 <= R < 1.0
			torVerts[j+5] = Math.random();		// random color 0.0 <= G < 1.0
			torVerts[j+6] = Math.random();		// random color 0.0 <= B < 1.0
		}
	}
	// Repeat the 1st 2 vertices of the triangle strip to complete the torus:
			torVerts[j  ] = rbend + rbar;	// copy vertex zero;
						  //	x = (rbend + rbar*cos(phi==0)) * cos(theta==0)
			torVerts[j+1] = 0.0;
							//  y = (rbend + rbar*cos(phi==0)) * sin(theta==0) 
			torVerts[j+2] = 0.0;
							//  z = -rbar  *   sin(phi==0)
			torVerts[j+3] = 1.0;		// w
			torVerts[j+4] = Math.random();		// random color 0.0 <= R < 1.0
			torVerts[j+5] = Math.random();		// random color 0.0 <= G < 1.0
			torVerts[j+6] = Math.random();		// random color 0.0 <= B < 1.0
			j+=7; // go to next vertex:
			torVerts[j  ] = (rbend + rbar) * Math.cos(thetaStep);
						  //	x = (rbend + rbar*cos(phi==0)) * cos(theta==thetaStep)
			torVerts[j+1] = (rbend + rbar) * Math.sin(thetaStep);
							//  y = (rbend + rbar*cos(phi==0)) * sin(theta==thetaStep) 
			torVerts[j+2] = 0.0;
							//  z = -rbar  *   sin(phi==0)
			torVerts[j+3] = 1.0;		// w
			torVerts[j+4] = Math.random();		// random color 0.0 <= R < 1.0
			torVerts[j+5] = Math.random();		// random color 0.0 <= G < 1.0
			torVerts[j+6] = Math.random();		// random color 0.0 <= B < 1.0
}

function makeAxes() {

axesVerts = new Float32Array([

	-50, 0.0, 0.0, 1.0,		1.0, 0.0, 0.0,
	50, 0.0, 0.0, 1.0, 		1.0, 0.0, 0.0,

	0.0, -50.0, 0.0, 1.0, 	0.0, 1.0, 0.0,
	0.0, 50.0, 0.0, 1.0, 	0.0, 1.0, 0.0,

	0.0, 0.0, -50.0, 1.0, 	0.0, 0.0, 1.0,
	0.0, 0.0, 50.0, 1.0, 	0.0, 0.0, 1.0,

])
}

function makeGroundGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 100;			// # of lines to draw in x,y to make the grid.
	var ycount = 100;		
	var xymax	= 100.0;			// grid size; extends to cover +/-xymax in x and y.
 	var xColr = new Float32Array([1.0, 1.0, 0.3]);	// bright yellow
 	var yColr = new Float32Array([0.5, 1.0, 0.5]);	// bright green.
 	
	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
						// draw a grid made of xcount+ycount lines; 2 vertices per line.
						
	var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
	var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
	
	// First, step thru x values as we make vertical lines of constant-x:
	for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
		if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j  ] = -xymax + (v  )*xgap;	// x
			gndVerts[j+1] = -xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
			gndVerts[j+1] = xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = xColr[0];			// red
		gndVerts[j+5] = xColr[1];			// grn
		gndVerts[j+6] = xColr[2];			// blu
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
		if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j  ] = -xymax;								// x
			gndVerts[j+1] = -xymax + (v  )*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j  ] = xymax;								// x
			gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = yColr[0];			// red
		gndVerts[j+5] = yColr[1];			// grn
		gndVerts[j+6] = yColr[2];			// blu
	}
}

function drawProjected(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position) {

	console.log("drawProjected");
	console.log(eye_position);
	console.log(lookat_position);
	console.log(g_theta);
	console.log(g_zOffset);

	// SAVE lens world coord;  
	pushMatrix(modelMatrix);

	// Camera position
	modelMatrix.lookAt( eye_position[0], eye_position[1], eye_position[2],	// center of projection
		lookat_position[0], lookat_position[1], lookat_position[2],	// look-at point 
		0, 0, 1);	// View UP vector.

	// SAVE world coord system;  
	pushMatrix(modelMatrix);

	//-------- Draw Crystal Defense System:

	
	modelMatrix.translate(-1, -1, 0.5);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(1,1,1);	
	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.

    //Adding the crystal
	modelMatrix.translate(0.0, 0.95, 0.0);
    modelMatrix.rotate(g_angle01, 1, 1, 0);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	//Adding the pyramid
	modelMatrix.translate(0.0, 0.95, 0.0);
	modelMatrix.rotate(currentAngle*2, 0, 1, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							pyramidStart/floatsPerVertex, // start at this vertex number, and
								pyramidVerts.length/floatsPerVertex);	// draw this many vertices.

	//Adding another Crystal
	modelMatrix.translate(0.0, 1, 0.0);
    modelMatrix.rotate(currentAngle, 0, 0, 1);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	// -----------------AXES ON JOINT-----------------

	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	modelMatrix.scale(0.1, 0.1, 0.1);  // shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  axesStart/floatsPerVertex,	// start at this vertex number, and
							  axesVerts.length/floatsPerVertex);	// draw this many vertices.
							  
	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	// ------------------END OF AXES-------------

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	//Add the other houses

	pushMatrix(modelMatrix);		// Saving world coord system
	
	modelMatrix.translate(1, 1, 0.5);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(1,1,1);	
	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	pushMatrix(modelMatrix);		// Saving world coord system
	
	modelMatrix.translate(1, -1, 0.5);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(1,1,1);	
	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	pushMatrix(modelMatrix);		// Saving world coord system
	
	modelMatrix.translate(-1, 1, 0.5);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(1,1,1);	
	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.


	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	
	  
	//===========================================================
  	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	modelMatrix.translate(0.4, -0.4, 0.0);	
  	modelMatrix.scale(0.1, 0.1, 0.1);  // shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  gndStart/floatsPerVertex,	// start at this vertex number, and
							  gndVerts.length/floatsPerVertex);	// draw this many vertices.
							  
	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	//===========================================================
	//AXES OF THE WORLD
  	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	modelMatrix.translate(0.0, 0.0, 0.0);	
  	modelMatrix.scale(0.1, 0.1, 0.1);  // shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  axesStart/floatsPerVertex,	// start at this vertex number, and
							  axesVerts.length/floatsPerVertex);	// draw this many vertices.
							  
	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.


	//==========================================================
	//ROTATING CRYSTAL

	pushMatrix(modelMatrix);		// Saving world coord system
	
	modelMatrix.translate(0, 0, 0.5);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(1,1,1);	

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	modelMatrix = popMatrix();  // RESTORE lense drawing coords.
}

function drawAll(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position) {
//==============================================================================
	// Clear <canvas>  colors AND the depth buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	//----------------------Create, fill LEFT viewport------------------------
	gl.viewport(0,
		0, 						// location(in pixels)
	  g_canvas.width/2, 		// viewport width,
	  g_canvas.height);			// viewport height in pixels.

	var vpAspect = (g_canvas.width/2) / g_canvas.height;	// onscreen aspect ratio for this camera: width/height.

	modelMatrix.setIdentity();    // DEFINE 'world-space' coords.
	
	// Define 'camera lens':
	var fovy = 40.0;
	var near = 1.0;
	var far = 100.0;
	modelMatrix.perspective(fovy,   // FOVY: top-to-bottom vertical image angle, in degrees
		vpAspect,   // Image Aspect Ratio: camera lens width/height
		near,   // camera z-near distance (always positive; frustum begins at z = -znear)
		far);  // camera z-far distance (always positive; frustum ends at z = -zfar)
	
	drawProjected(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position);

  //----------------------Create, fill RIGHT viewport------------------------
	gl.viewport(g_canvas.width/2,						// Viewport lower-left corner
		0, 												// location(in pixels)
	  g_canvas.width/2, 								// viewport width,
	  g_canvas.height);			  						// viewport height in pixels.

	vpAspect = (g_canvas.width/2) /	g_canvas.height;				// Onscreen aspect ration for this camera: width/height.

	var perspective_frustum_height = 2 * Math.tan(Math.PI/180 * fovy/2) * (far-near)/3;  // frustum height at z=(far-near)/3 distance
	var perspective_frustum_width = vpAspect * perspective_frustum_height;


	// For this viewport, set camera's eye point and the viewing volume:
	modelMatrix.setOrtho(-perspective_frustum_width/2,  //left
		perspective_frustum_width/2,  //right
		-perspective_frustum_height/2,  //bottom
		perspective_frustum_height/2,  //top
		near,  //near
		far);  //far

	drawProjected(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position);
}

// updates camera position based on keyboard input
function updateCameraPositions(eye_position, lookat_position) {
	// Update theta and zOffset
	g_theta += g_thetaRate;
	g_zOffset += g_zOffsetRate;

	// element-wise subtraction and mult of velocity
	var displacement = [];
	for(var i = 0;i<=lookat_position.length-1;i++)
  		displacement.push((lookat_position[i] - eye_position[i]) * g_lookatTranslate * 0.02);

	// element-wise add displacement to eye position
	for(var i = 0;i<=lookat_position.length-1;i++) {
		eye_position[i] += displacement[i];
	}

	// element-wise add strafing to eye position
	eye_position[0] += Math.cos(g_theta + Math.PI/2) * g_strafeTranslate * 0.02;
	eye_position[1] += Math.sin(g_theta + Math.PI/2) * g_strafeTranslate * 0.02;


	// update look at position
	lookat_position[0] = eye_position[0] + Math.cos(g_theta);
	lookat_position[1] = eye_position[1] + Math.sin(g_theta);
	lookat_position[2] = eye_position[2] + g_zOffset;

	console.log("updateCameraPosition")
	console.log(eye_position);
	console.log(lookat_position);
	console.log(displacement);
	console.log(g_theta);
	console.log(g_zOffset);
	

}

// Last time that this function was called:  (used for animation timing)
var g_last = Date.now();

function animate(angle) {
//==============================================================================
	// Calculate the elapsed time
	var now = Date.now();
	var elapsed = now - g_last;
	g_last = now;    
	// Update the current rotation angle (adjusted by the elapsed time)
	//  limit the angle to move smoothly between +20 and -85 degrees:
	//  if(angle >  120.0 && ANGLE_STEP > 0) ANGLE_STEP = -ANGLE_STEP;
	//  if(angle < -120.0 && ANGLE_STEP < 0) ANGLE_STEP = -ANGLE_STEP;

	g_angle01 =g_angle01 + (g_angle01Rate * elapsed) / 1000.0;
  if (g_angle01 > g_angle01max && g_angle01Rate >0) g_angle01Rate = -g_angle01Rate;
  if (g_angle01 < g_angle01min && g_angle01Rate <0) g_angle01Rate = -g_angle01Rate;
  
	var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
	return newAngle %= 360;
}


//==================HTML Button Callbacks
function nextShape() {
	shapeNum += 1;
	if(shapeNum >= shapeMax) shapeNum = 0;
}

function spinDown() {
 ANGLE_STEP -= 25; 
}

function spinUp() {
  ANGLE_STEP += 25; 
}

function runStop() {
  if(ANGLE_STEP*ANGLE_STEP > 1) {
    myTmp = ANGLE_STEP;
    ANGLE_STEP = 0;
  }
  else {
  	ANGLE_STEP = myTmp;
  }
}

function resizeCanvas() {
	//==============================================================================
	// Called when user re-sizes their browser window and on load, because our HTML file
	// contains:  <body onload="main()" onresize="winResize()">
	
	// Report our current browser-window contents:
	
	console.log('g_Canvas width,height=', g_canvas.width, g_canvas.height);		
	console.log('Browser window: innerWidth,innerHeight=', innerWidth, innerHeight);
	
	// Make canvas fill the top 70% of our browser window:
	var xtraMargin = 16;    // keep a margin (otherwise, browser adds scroll-bars)
	g_canvas.width = innerWidth - xtraMargin;
	g_canvas.height = (innerHeight*.7) - xtraMargin;
}
 

function myKeyDown(kev) {
	//===============================================================================
	// Called when user presses down ANY key on the keyboard;
	//
	// For a light, easy explanation of keyboard events in JavaScript,
	// see:    http://www.kirupa.com/html5/keyboard_events_in_javascript.htm
	// For a thorough explanation of a mess of JavaScript keyboard event handling,
	// see:    http://javascript.info/tutorial/keyboard-events
	//
	// NOTE: Mozilla deprecated the 'keypress' event entirely, and in the
	//        'keydown' event deprecated several read-only properties I used
	//        previously, including kev.charCode, kev.keyCode. 
	//        Revised 2/2019:  use kev.key and kev.code instead.
	//
	// Report EVERYTHING in console:
	  console.log(  "--kev.code:",    kev.code,   "\t\t--kev.key:",     kev.key, 
				  "\n--kev.ctrlKey:", kev.ctrlKey,  "\t--kev.shiftKey:",kev.shiftKey,
				  "\n--kev.altKey:",  kev.altKey,   "\t--kev.metaKey:", kev.metaKey);

	switch(kev.code) {
		//----------------WASD keys------------------------
		case "KeyA":
			console.log("a/A key: Strafe LEFT!\n");
			g_strafeTranslate = 1;
			console.log(g_strafeTranslate);
			break;
		case "KeyD":
			console.log("d/D key: Strafe RIGHT!\n");
			g_strafeTranslate = -1;
			console.log(g_strafeTranslate);
			break;
		case "KeyS":
			console.log("s/S key: Move BACK!\n");
			g_lookatTranslate = -1;
			console.log(g_lookatTranslate);
			break;
		case "KeyW":
			console.log("w/W key: Move FWD!\n");
			g_lookatTranslate = 1;
			console.log(g_lookatTranslate);
			break;
		//----------------Arrow keys------------------------
		case "ArrowLeft": 	
			console.log(' left-arrow.');
			g_thetaRate = 0.03;
			break;
		case "ArrowRight":
			console.log('right-arrow.');
			g_thetaRate = -0.03;
			break;
		case "ArrowUp":		
			console.log('   up-arrow.');
			g_zOffsetRate = 0.02;
			break;
		case "ArrowDown":
			console.log(' down-arrow.');
			g_zOffsetRate = -0.02;
			break;	
		default:
			console.log("UNUSED!");
			break;
	}
}


function myKeyUp(kev) {
	//===============================================================================
	// Called when user releases ANY key on the keyboard; captures scancodes well
	
	console.log('myKeyUp()--keyCode='+kev.keyCode+' released.');
	switch(kev.code) {
		//----------------WASD keys------------------------
		case "KeyA":
			g_strafeTranslate = 0;
			console.log(g_strafeTranslate);
			break;
		case "KeyD":
			g_strafeTranslate = 0;
			console.log(g_strafeTranslate);
			break;
		case "KeyS":
			g_lookatTranslate = 0;
			console.log(g_lookatTranslate);
			break;
		case "KeyW":
			g_lookatTranslate = 0;
			console.log(g_lookatTranslate);
			break;
		//----------------Arrow keys------------------------
		case "ArrowLeft": 	
			g_thetaRate = 0;
			break;
		case "ArrowRight":
			g_thetaRate = 0;
			break;
		case "ArrowUp":
			g_zOffsetRate = 0;
			break;
		case "ArrowDown":
			g_zOffsetRate = 0;
			break;	
		default:
			break;
	}

	}

function myMouseDown(ev) {
//==============================================================================
// Called when user PRESSES down any mouse button;
// 									(Which button?    console.log('ev.button='+ev.button);   )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
  var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);
//	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
	
	g_isDrag = true;											// set our mouse-dragging flag
	g_xMclik = x;													// record where mouse-dragging began
	g_yMclik = y;
	// report on webpage
	document.getElementById('MouseAtResult').innerHTML = 
	  'Mouse At: '+x.toFixed(5)+', '+y.toFixed(5);
};

function myMouseMove(ev) {
//==============================================================================
// Called when user MOVES the mouse with a button already pressed down.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	if(g_isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);
//	console.log('myMouseMove(CVV coords  ):  x, y=\t',x,',\t',y);

	// find how far we dragged the mouse:
	g_xMdragTot += (x - g_xMclik);					// Accumulate change-in-mouse-position,&
	g_yMdragTot += (y - g_yMclik);
	// Report new mouse position & how far we moved on webpage:
	document.getElementById('MouseAtResult').innerHTML = 
	  'Mouse At: '+x.toFixed(5)+', '+y.toFixed(5);
	document.getElementById('MouseDragResult').innerHTML = 
	  'Mouse Drag: '+(x - g_xMclik).toFixed(5)+', '+(y - g_yMclik).toFixed(5);

	g_xMclik = x;													// Make next drag-measurement from here.
	g_yMclik = y;
};

function myMouseUp(ev) {
//==============================================================================
// Called when user RELEASES mouse button pressed previously.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);
	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
	
	g_isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	g_xMdragTot += (x - g_xMclik);
	g_yMdragTot += (y - g_yMclik);
	// Report new mouse position:
	document.getElementById('MouseAtResult').innerHTML = 
	  'Mouse At: '+x.toFixed(5)+', '+y.toFixed(5);
	console.log('myMouseUp: g_xMdragTot,g_yMdragTot =',g_xMdragTot,',\t',g_yMdragTot);
};

function myMouseClick(ev) {
//=============================================================================
// Called when user completes a mouse-button single-click event 
// (e.g. mouse-button pressed down, then released)
// 									   
//    WHICH button? try:  console.log('ev.button='+ev.button); 
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!) 
//    See myMouseUp(), myMouseDown() for conversions to  CVV coordinates.

  // STUB
	console.log("myMouseClick() on button: ", ev.button); 
}	

function myMouseDblClick(ev) {
//=============================================================================
// Called when user completes a mouse-button double-click event 
// 									   
//    WHICH button? try:  console.log('ev.button='+ev.button); 
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!) 
//    See myMouseUp(), myMouseDown() for conversions to  CVV coordinates.

  // STUB
	console.log("myMouse-DOUBLE-Click() on button: ", ev.button); 
}	













// START OF THE cuon-matrix-quat03.js CODE

// cuon-matrix.js (c) 2012 kanda and matsuda/**  * This is a class treating 4x4 matrix from the book  *	'WebGL Programming Guide' (2013), * MODIFIED 2/2014,8 by Jack Tumblin and students in Northwestern Univ EECS 351-1 * "Intro to Computer Grapics'. * --added 'pushMatrix()' and 'popMatrix()' member fcns to provide a push-down/ *    pop-up stack for any Matrix4 object, useful for traversing scene graphs. * --added Quaternion class (at end; modified from early THREE.js library) * --added 'printMe' member functions to print vector, matrix, and quaternions *	     in JavaScript console using 'console.log()' function * * --This library's 'setXXX()' functions replace current matrix contents; *  (e.g. setIdentity(), setRotate(), etc) and its 'concat()' and 'XXX()' fcns *  (e.g. rotate(), translate(), scale() etc) multiply current matrix contents  * with a with the function's newly-created matrix, e.g.: *  					[M_new] = [M_old][M_rotate]  * and returns matrix M_new. *//** * Constructor of Matrix4 * If opt_src is specified, new matrix is initialized by opt_src. * Otherwise, new matrix is initialized by identity matrix. * @param opt_src source matrix(option) */var Matrix4 = function(opt_src) {  var i, s, d;  if (opt_src && typeof opt_src === 'object' && opt_src.hasOwnProperty('elements')) {    s = opt_src.elements;    d = new Float32Array(16);    for (i = 0; i < 16; ++i) {      d[i] = s[i];    }    this.elements = d;  } else {    this.elements = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);  }}; /** * Set the identity matrix. * @return this */Matrix4.prototype.setIdentity = function() {  var e = this.elements;  e[0] = 1;   e[4] = 0;   e[8]  = 0;   e[12] = 0;  e[1] = 0;   e[5] = 1;   e[9]  = 0;   e[13] = 0;  e[2] = 0;   e[6] = 0;   e[10] = 1;   e[14] = 0;  e[3] = 0;   e[7] = 0;   e[11] = 0;   e[15] = 1;  return this;};/** * Copy matrix. * @param src source matrix * @return this */Matrix4.prototype.set = function(src) {  var i, s, d;  s = src.elements;  d = this.elements;  if (s === d) {		// do nothing if given 'this' as arg.    return;  }      for (i = 0; i < 16; ++i) {	    d[i] = s[i];  }  return this;};/** * Multiply the matrix from the right. * @param other The multiply matrix * @return this */Matrix4.prototype.concat = function(other) {  var i, e, a, b, ai0, ai1, ai2, ai3;    // Calculate e = a * b  e = this.elements;  a = this.elements;  b = other.elements;    // If e equals b, copy b to temporary matrix.  if (e === b) {    b = new Float32Array(16);    for (i = 0; i < 16; ++i) {      b[i] = e[i];    }  }    for (i = 0; i < 4; i++) {    ai0=a[i];  ai1=a[i+4];  ai2=a[i+8];  ai3=a[i+12];    e[i]    = ai0 * b[0]  + ai1 * b[1]  + ai2 * b[2]  + ai3 * b[3];    e[i+4]  = ai0 * b[4]  + ai1 * b[5]  + ai2 * b[6]  + ai3 * b[7];    e[i+8]  = ai0 * b[8]  + ai1 * b[9]  + ai2 * b[10] + ai3 * b[11];    e[i+12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];  }    return this;};Matrix4.prototype.multiply = Matrix4.prototype.concat;/** * Multiply the three-dimensional vector (presumes w==1) * @param pos  The multiply vector * @return The result of multiplication(Float32Array) */Matrix4.prototype.multiplyVector3 = function(pos) {  var e = this.elements;  var p = pos.elements;  var v = new Vector3();  var result = v.elements;  result[0] = p[0] * e[0] + p[1] * e[4] + p[2] * e[ 8] + e[11]; // note the added 4th column  result[1] = p[0] * e[1] + p[1] * e[5] + p[2] * e[ 9] + e[12]; // (presumes hidden 4th vector element w==1)  result[2] = p[0] * e[2] + p[1] * e[6] + p[2] * e[10] + e[13];  return v;};/** * Multiply the four-dimensional vector. * @param pos  The multiply vector * @return The result of multiplication(Float32Array) */Matrix4.prototype.multiplyVector4 = function(pos) {  var e = this.elements;  var p = pos.elements;  var v = new Vector4();  var result = v.elements;  result[0] = p[0] * e[0] + p[1] * e[4] + p[2] * e[ 8] + p[3] * e[12];  result[1] = p[0] * e[1] + p[1] * e[5] + p[2] * e[ 9] + p[3] * e[13];  result[2] = p[0] * e[2] + p[1] * e[6] + p[2] * e[10] + p[3] * e[14];  result[3] = p[0] * e[3] + p[1] * e[7] + p[2] * e[11] + p[3] * e[15];  return v;};/** * Transpose the matrix. * @return this */Matrix4.prototype.transpose = function() {  var e, t;  e = this.elements;  t = e[ 1];  e[ 1] = e[ 4];  e[ 4] = t;  t = e[ 2];  e[ 2] = e[ 8];  e[ 8] = t;  t = e[ 3];  e[ 3] = e[12];  e[12] = t;  t = e[ 6];  e[ 6] = e[ 9];  e[ 9] = t;  t = e[ 7];  e[ 7] = e[13];  e[13] = t;  t = e[11];  e[11] = e[14];  e[14] = t;  return this;};/** * Calculate the inverse matrix of specified matrix, and set to this. * @param other The source matrix * @return this */Matrix4.prototype.setInverseOf = function(other) {  var i, s, d, inv, det;  s = other.elements;  d = this.elements;  inv = new Float32Array(16);  inv[0]  =   s[5]*s[10]*s[15] - s[5] *s[11]*s[14] - s[9] *s[6]*s[15]            + s[9]*s[7] *s[14] + s[13]*s[6] *s[11] - s[13]*s[7]*s[10];  inv[4]  = - s[4]*s[10]*s[15] + s[4] *s[11]*s[14] + s[8] *s[6]*s[15]            - s[8]*s[7] *s[14] - s[12]*s[6] *s[11] + s[12]*s[7]*s[10];  inv[8]  =   s[4]*s[9] *s[15] - s[4] *s[11]*s[13] - s[8] *s[5]*s[15]            + s[8]*s[7] *s[13] + s[12]*s[5] *s[11] - s[12]*s[7]*s[9];  inv[12] = - s[4]*s[9] *s[14] + s[4] *s[10]*s[13] + s[8] *s[5]*s[14]            - s[8]*s[6] *s[13] - s[12]*s[5] *s[10] + s[12]*s[6]*s[9];  inv[1]  = - s[1]*s[10]*s[15] + s[1] *s[11]*s[14] + s[9] *s[2]*s[15]            - s[9]*s[3] *s[14] - s[13]*s[2] *s[11] + s[13]*s[3]*s[10];  inv[5]  =   s[0]*s[10]*s[15] - s[0] *s[11]*s[14] - s[8] *s[2]*s[15]            + s[8]*s[3] *s[14] + s[12]*s[2] *s[11] - s[12]*s[3]*s[10];  inv[9]  = - s[0]*s[9] *s[15] + s[0] *s[11]*s[13] + s[8] *s[1]*s[15]            - s[8]*s[3] *s[13] - s[12]*s[1] *s[11] + s[12]*s[3]*s[9];  inv[13] =   s[0]*s[9] *s[14] - s[0] *s[10]*s[13] - s[8] *s[1]*s[14]            + s[8]*s[2] *s[13] + s[12]*s[1] *s[10] - s[12]*s[2]*s[9];  inv[2]  =   s[1]*s[6]*s[15] - s[1] *s[7]*s[14] - s[5] *s[2]*s[15]            + s[5]*s[3]*s[14] + s[13]*s[2]*s[7]  - s[13]*s[3]*s[6];  inv[6]  = - s[0]*s[6]*s[15] + s[0] *s[7]*s[14] + s[4] *s[2]*s[15]            - s[4]*s[3]*s[14] - s[12]*s[2]*s[7]  + s[12]*s[3]*s[6];  inv[10] =   s[0]*s[5]*s[15] - s[0] *s[7]*s[13] - s[4] *s[1]*s[15]            + s[4]*s[3]*s[13] + s[12]*s[1]*s[7]  - s[12]*s[3]*s[5];  inv[14] = - s[0]*s[5]*s[14] + s[0] *s[6]*s[13] + s[4] *s[1]*s[14]            - s[4]*s[2]*s[13] - s[12]*s[1]*s[6]  + s[12]*s[2]*s[5];  inv[3]  = - s[1]*s[6]*s[11] + s[1]*s[7]*s[10] + s[5]*s[2]*s[11]            - s[5]*s[3]*s[10] - s[9]*s[2]*s[7]  + s[9]*s[3]*s[6];  inv[7]  =   s[0]*s[6]*s[11] - s[0]*s[7]*s[10] - s[4]*s[2]*s[11]            + s[4]*s[3]*s[10] + s[8]*s[2]*s[7]  - s[8]*s[3]*s[6];  inv[11] = - s[0]*s[5]*s[11] + s[0]*s[7]*s[9]  + s[4]*s[1]*s[11]            - s[4]*s[3]*s[9]  - s[8]*s[1]*s[7]  + s[8]*s[3]*s[5];  inv[15] =   s[0]*s[5]*s[10] - s[0]*s[6]*s[9]  - s[4]*s[1]*s[10]            + s[4]*s[2]*s[9]  + s[8]*s[1]*s[6]  - s[8]*s[2]*s[5];  det = s[0]*inv[0] + s[1]*inv[4] + s[2]*inv[8] + s[3]*inv[12];  if (det === 0) {    return this;  }  det = 1 / det;  for (i = 0; i < 16; i++) {    d[i] = inv[i] * det;  }  return this;};/** * Calculate the inverse matrix of this, and set to this. * @return this */Matrix4.prototype.invert = function() {  return this.setInverseOf(this);};/** * Set the orthographic projection matrix. * @param left The coordinate of the left of clipping plane. * @param right The coordinate of the right of clipping plane. * @param bottom The coordinate of the bottom of clipping plane. * @param top The coordinate of the top top clipping plane. * @param near The distances to the nearer depth clipping plane. This value is minus if the plane is to be behind the viewer. * @param far The distances to the farther depth clipping plane. This value is minus if the plane is to be behind the viewer. * @return this */Matrix4.prototype.setOrtho = function(left, right, bottom, top, near, far) {  var e, rw, rh, rd;  if (left === right || bottom === top || near === far) {    throw 'null frustum';  }  rw = 1 / (right - left);  rh = 1 / (top - bottom);  rd = 1 / (far - near);  e = this.elements;  e[0]  = 2 * rw;  e[1]  = 0;  e[2]  = 0;  e[3]  = 0;  e[4]  = 0;  e[5]  = 2 * rh;  e[6]  = 0;  e[7]  = 0;  e[8]  = 0;  e[9]  = 0;  e[10] = -2 * rd;  e[11] = 0;  e[12] = -(right + left) * rw;  e[13] = -(top + bottom) * rh;  e[14] = -(far + near) * rd;  e[15] = 1;  return this;};/** * Multiply the orthographic projection matrix from the right. * @param left The coordinate of the left of clipping plane. * @param right The coordinate of the right of clipping plane. * @param bottom The coordinate of the bottom of clipping plane. * @param top The coordinate of the top top clipping plane. * @param near The distances to the nearer depth clipping plane. This value is minus if the plane is to be behind the viewer. * @param far The distances to the farther depth clipping plane. This value is minus if the plane is to be behind the viewer. * @return this */Matrix4.prototype.ortho = function(left, right, bottom, top, near, far) {  return this.concat(new Matrix4().setOrtho(left, right, bottom, top, near, far));};/** * Set the perspective projection matrix. * @param left The coordinate of the left of clipping plane. * @param right The coordinate of the right of clipping plane. * @param bottom The coordinate of the bottom of clipping plane. * @param top The coordinate of the top top clipping plane. * @param near The distances to the nearer depth clipping plane. This value must be plus value. * @param far The distances to the farther depth clipping plane. This value must be plus value. * @return this */Matrix4.prototype.setFrustum = function(left, right, bottom, top, near, far) {  var e, rw, rh, rd;  if (left === right || top === bottom || near === far) {    throw 'null frustum';  }  if (near <= 0) {    throw 'near <= 0';  }  if (far <= 0) {    throw 'far <= 0';  }  rw = 1 / (right - left);  rh = 1 / (top - bottom);  rd = 1 / (far - near);  e = this.elements;  e[ 0] = 2 * near * rw;  e[ 1] = 0;  e[ 2] = 0;  e[ 3] = 0;  e[ 4] = 0;  e[ 5] = 2 * near * rh;  e[ 6] = 0;  e[ 7] = 0;  e[ 8] = (right + left) * rw;  e[ 9] = (top + bottom) * rh;  e[10] = -(far + near) * rd;  e[11] = -1;  e[12] = 0;  e[13] = 0;  e[14] = -2 * near * far * rd;  e[15] = 0;  return this;};/** * Multiply the perspective projection matrix from the right. * @param left The coordinate of the left of clipping plane. * @param right The coordinate of the right of clipping plane. * @param bottom The coordinate of the bottom of clipping plane. * @param top The coordinate of the top top clipping plane. * @param near The distances to the nearer depth clipping plane. This value must be plus value. * @param far The distances to the farther depth clipping plane. This value must be plus value. * @return this */Matrix4.prototype.frustum = function(left, right, bottom, top, near, far) {  return this.concat(new Matrix4().setFrustum(left, right, bottom, top, near, far));};/** * Set the perspective projection matrix by fovy and aspect. * @param fovy The angle in degrees between the upper and lower sides of the frustum. * @param aspect The aspect ratio of the frustum. (width/height) * @param near The distances to the nearer depth clipping plane. This value must be plus value. * @param far The distances to the farther depth clipping plane. This value must be plus value. * @return this */Matrix4.prototype.setPerspective = function(fovy, aspect, near, far) {  var e, rd, s, ct;  if (near === far || aspect === 0) {    throw 'null frustum';  }  if (near <= 0) {    throw 'near <= 0';  }  if (far <= 0) {    throw 'far <= 0';  }  fovy = Math.PI * fovy / 180 / 2;  s = Math.sin(fovy);  if (s === 0) {    throw 'null frustum';  }  rd = 1 / (far - near);  ct = Math.cos(fovy) / s;  e = this.elements;  e[0]  = ct / aspect;  e[1]  = 0;  e[2]  = 0;  e[3]  = 0;  e[4]  = 0;  e[5]  = ct;  e[6]  = 0;  e[7]  = 0;  e[8]  = 0;  e[9]  = 0;  e[10] = -(far + near) * rd;  e[11] = -1;  e[12] = 0;  e[13] = 0;  e[14] = -2 * near * far * rd;  e[15] = 0;  return this;};/** * Multiply the perspective projection matrix from the right. * @param fovy The angle in degrees between the upper and lower sides of the frustum. * @param aspect The aspect ratio of the frustum. (width/height) * @param near The distances to the nearer depth clipping plane. This value must be plus value. * @param far The distances to the farther depth clipping plane. This value must be plus value. * @return this */Matrix4.prototype.perspective = function(fovy, aspect, near, far) {  return this.concat(new Matrix4().setPerspective(fovy, aspect, near, far));};/** * Set the matrix for scaling. * @param x The scale factor along the X axis * @param y The scale factor along the Y axis * @param z The scale factor along the Z axis * @return this */Matrix4.prototype.setScale = function(x, y, z) {  var e = this.elements;  e[0] = x;  e[4] = 0;  e[8]  = 0;  e[12] = 0;  e[1] = 0;  e[5] = y;  e[9]  = 0;  e[13] = 0;  e[2] = 0;  e[6] = 0;  e[10] = z;  e[14] = 0;  e[3] = 0;  e[7] = 0;  e[11] = 0;  e[15] = 1;  return this;};/** * Multiply the matrix for scaling from the right. * @param x The scale factor along the X axis * @param y The scale factor along the Y axis * @param z The scale factor along the Z axis * @return this */Matrix4.prototype.scale = function(x, y, z) {  var e = this.elements;  e[0] *= x;  e[4] *= y;  e[8]  *= z;  e[1] *= x;  e[5] *= y;  e[9]  *= z;  e[2] *= x;  e[6] *= y;  e[10] *= z;  e[3] *= x;  e[7] *= y;  e[11] *= z;  return this;};/** * Set the matrix for translation. * @param x The X value of a translation. * @param y The Y value of a translation. * @param z The Z value of a translation. * @return this */Matrix4.prototype.setTranslate = function(x, y, z) {  var e = this.elements;  e[0] = 1;  e[4] = 0;  e[8]  = 0;  e[12] = x;  e[1] = 0;  e[5] = 1;  e[9]  = 0;  e[13] = y;  e[2] = 0;  e[6] = 0;  e[10] = 1;  e[14] = z;  e[3] = 0;  e[7] = 0;  e[11] = 0;  e[15] = 1;  return this;};/** * Multiply the matrix for translation from the right. * @param x The X value of a translation. * @param y The Y value of a translation. * @param z The Z value of a translation. * @return this */Matrix4.prototype.translate = function(x, y, z) {  var e = this.elements;  e[12] += e[0] * x + e[4] * y + e[8]  * z;  e[13] += e[1] * x + e[5] * y + e[9]  * z;  e[14] += e[2] * x + e[6] * y + e[10] * z;  e[15] += e[3] * x + e[7] * y + e[11] * z;  return this;};/** * Set the matrix for rotation. * The vector of rotation axis may not be normalized. * @param angle The angle of rotation (degrees) * @param x The X coordinate of vector of rotation axis. * @param y The Y coordinate of vector of rotation axis. * @param z The Z coordinate of vector of rotation axis. * @return this */Matrix4.prototype.setRotate = function(angle, x, y, z) {  var e, s, c, len, rlen, nc, xy, yz, zx, xs, ys, zs;  angle = Math.PI * angle / 180;  e = this.elements;  s = Math.sin(angle);  c = Math.cos(angle);  if (0 !== x && 0 === y && 0 === z) {    // Rotation around X axis    if (x < 0) {      s = -s;    }    e[0] = 1;  e[4] = 0;  e[ 8] = 0;  e[12] = 0;    e[1] = 0;  e[5] = c;  e[ 9] =-s;  e[13] = 0;    e[2] = 0;  e[6] = s;  e[10] = c;  e[14] = 0;    e[3] = 0;  e[7] = 0;  e[11] = 0;  e[15] = 1;  } else if (0 === x && 0 !== y && 0 === z) {    // Rotation around Y axis    if (y < 0) {      s = -s;    }    e[0] = c;  e[4] = 0;  e[ 8] = s;  e[12] = 0;    e[1] = 0;  e[5] = 1;  e[ 9] = 0;  e[13] = 0;    e[2] =-s;  e[6] = 0;  e[10] = c;  e[14] = 0;    e[3] = 0;  e[7] = 0;  e[11] = 0;  e[15] = 1;  } else if (0 === x && 0 === y && 0 !== z) {    // Rotation around Z axis    if (z < 0) {      s = -s;    }    e[0] = c;  e[4] =-s;  e[ 8] = 0;  e[12] = 0;    e[1] = s;  e[5] = c;  e[ 9] = 0;  e[13] = 0;    e[2] = 0;  e[6] = 0;  e[10] = 1;  e[14] = 0;    e[3] = 0;  e[7] = 0;  e[11] = 0;  e[15] = 1;  } else {    // Rotation around another axis    len = Math.sqrt(x*x + y*y + z*z);    if (len !== 1) {      rlen = 1 / len;      x *= rlen;      y *= rlen;      z *= rlen;    }    nc = 1 - c;    xy = x * y;    yz = y * z;    zx = z * x;    xs = x * s;    ys = y * s;    zs = z * s;    e[ 0] = x*x*nc +  c;    e[ 1] = xy *nc + zs;    e[ 2] = zx *nc - ys;    e[ 3] = 0;    e[ 4] = xy *nc - zs;    e[ 5] = y*y*nc +  c;    e[ 6] = yz *nc + xs;    e[ 7] = 0;    e[ 8] = zx *nc + ys;    e[ 9] = yz *nc - xs;    e[10] = z*z*nc +  c;    e[11] = 0;    e[12] = 0;    e[13] = 0;    e[14] = 0;    e[15] = 1;  }  return this;};/** * Multiply the matrix for rotation from the right. * The vector of rotation axis may not be normalized. * @param angle The angle of rotation (degrees) * @param x The X coordinate of vector of rotation axis. * @param y The Y coordinate of vector of rotation axis. * @param z The Z coordinate of vector of rotation axis. * @return this */Matrix4.prototype.rotate = function(angle, x, y, z) {  return this.concat(new Matrix4().setRotate(angle, x, y, z));};/** * Set the viewing matrix. * @param eyeX, eyeY, eyeZ The position of the eye point. * @param centerX, centerY, centerZ The position of the reference point. * @param upX, upY, upZ The direction of the up vector. * @return this */Matrix4.prototype.setLookAt = function(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {  var e, fx, fy, fz, rlf, sx, sy, sz, rls, ux, uy, uz;  fx = centerX - eyeX;  fy = centerY - eyeY;  fz = centerZ - eyeZ;  // Normalize f.  rlf = 1 / Math.sqrt(fx*fx + fy*fy + fz*fz);  fx *= rlf;  fy *= rlf;  fz *= rlf;  // Calculate cross product of f and up.  sx = fy * upZ - fz * upY;  sy = fz * upX - fx * upZ;  sz = fx * upY - fy * upX;  // Normalize s.  rls = 1 / Math.sqrt(sx*sx + sy*sy + sz*sz);  sx *= rls;  sy *= rls;  sz *= rls;  // Calculate cross product of s and f.  ux = sy * fz - sz * fy;  uy = sz * fx - sx * fz;  uz = sx * fy - sy * fx;  // Set to this.  e = this.elements;  e[0] = sx;  e[1] = ux;  e[2] = -fx;  e[3] = 0;  e[4] = sy;  e[5] = uy;  e[6] = -fy;  e[7] = 0;  e[8] = sz;  e[9] = uz;  e[10] = -fz;  e[11] = 0;  e[12] = 0;  e[13] = 0;  e[14] = 0;  e[15] = 1;  // Translate.  return this.translate(-eyeX, -eyeY, -eyeZ);};/** * Multiply the viewing matrix from the right. * @param eyeX, eyeY, eyeZ The position of the eye point. * @param centerX, centerY, centerZ The position of the reference point. * @param upX, upY, upZ The direction of the up vector. * @return this */Matrix4.prototype.lookAt = function(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {  return this.concat(new Matrix4().setLookAt(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ));};/** * Multiply the matrix for project vertex to plane from the right. * @param plane The array[A, B, C, D] of the equation of plane "Ax + By + Cz + D = 0". * @param light The array which stored coordinates of the light. if light[3]=0, treated as parallel light. * @return this */Matrix4.prototype.dropShadow = function(plane, light) {  var mat = new Matrix4();  var e = mat.elements;  var dot = plane[0] * light[0] + plane[1] * light[1] + plane[2] * light[2] + plane[3] * light[3];  e[ 0] = dot - light[0] * plane[0];  e[ 1] =     - light[1] * plane[0];  e[ 2] =     - light[2] * plane[0];  e[ 3] =     - light[3] * plane[0];  e[ 4] =     - light[0] * plane[1];  e[ 5] = dot - light[1] * plane[1];  e[ 6] =     - light[2] * plane[1];  e[ 7] =     - light[3] * plane[1];  e[ 8] =     - light[0] * plane[2];  e[ 9] =     - light[1] * plane[2];  e[10] = dot - light[2] * plane[2];  e[11] =     - light[3] * plane[2];  e[12] =     - light[0] * plane[3];  e[13] =     - light[1] * plane[3];  e[14] =     - light[2] * plane[3];  e[15] = dot - light[3] * plane[3];  return this.concat(mat);}/** * Multiply the matrix for project vertex to plane from the right.(Projected by parallel light.) * @param normX, normY, normZ The normal vector of the plane.(Not necessary to be normalized.) * @param planeX, planeY, planeZ The coordinate of arbitrary points on a plane. * @param lightX, lightY, lightZ The vector of the direction of light.(Not necessary to be normalized.) * @return this */Matrix4.prototype.dropShadowDirectionally = function(normX, normY, normZ, planeX, planeY, planeZ, lightX, lightY, lightZ) {  var a = planeX * normX + planeY * normY + planeZ * normZ;  return this.dropShadow([normX, normY, normZ, -a], [lightX, lightY, lightZ, 0]);};/** *	Create rotation matrix from a given !UNIT-LENGTH! quaternion. * CAUTION!  forms WEIRD matrices from quaternions of other lengths! * @param qw the quaternion's 'real' coordinate * @param qx the quaternion's imaginary-i coord. * @param qy  "			"			"		imaginary-j coord. * @param qz  "			"			"		imaginary-k coord. *   -- Jack Tumblin 2/2014: from 'Math for 3D Game Programmng and CG" *													by Jed Lengyel, 34r Ed., pg. 91. */Matrix4.prototype.setFromQuat = function(qx, qy, qz, qw) {  var e = this.elements;  e[0]=1 -2*qy*qy -2*qz*qz; e[4]=   2*qx*qy -2*qw*qz; e[8] =   2*qx*qz +2*qw*qy;   																																		e[12] = 0;  e[1]=   2*qx*qy +2*qw*qz; e[5]=1 -2*qx*qx -2*qz*qz; e[9] =   2*qy*qz -2*qw*qx;  																																		e[13] = 0;  e[2]=   2*qx*qz -2*qw*qy; e[6]=   2*qy*qz +2*qw*qx; e[10]=1 -2*qx*qx -2*qy*qy;  																																		e[14] = 0;  e[3]= 0;  								e[7]= 0;  								e[11] = 0;  		e[15] = 1;	return this;}/** * print matrix contents in console window: *			(J. Tumblin 2014.02.15; updated 2018.02.01) */ Matrix4.prototype.printMe = function(opt_src) { var res = 5; var e = this.elements;   // why do this? just to make code more readable...  if(opt_src && typeof opt_src === 'string') {  // called w/ string argument?  // YES! use that string as our label:   console.log('-------------------', opt_src, '-------------------------');   console.log(	e[ 0].toFixed(res),'\t',e[ 4].toFixed(res),'\t',    							e[ 8].toFixed(res),'\t',e[12].toFixed(res));   console.log(	e[ 1].toFixed(res),'\t',e[ 5].toFixed(res),'\t',    							e[ 9].toFixed(res),'\t',e[13].toFixed(res));   console.log(	e[ 2].toFixed(res),'\t',e[ 6].toFixed(res),'\t',    							e[10].toFixed(res),'\t',e[14].toFixed(res));   console.log(	e[ 3].toFixed(res),'\t',e[ 7].toFixed(res),'\t',    							e[11].toFixed(res),'\t',e[15].toFixed(res));   console.log('-------------------', opt_src, '(end)--------------------\n');  }  else {   // No. use default labels:   console.log('----------------------4x4 Matrix----------------------------');   console.log(	e[ 0].toFixed(res),'\t',e[ 4].toFixed(res),'\t',    							e[ 8].toFixed(res),'\t',e[12].toFixed(res));   console.log(	e[ 1].toFixed(res),'\t',e[ 5].toFixed(res),'\t',    							e[ 9].toFixed(res),'\t',e[13].toFixed(res));   console.log(	e[ 2].toFixed(res),'\t',e[ 6].toFixed(res),'\t',    							e[10].toFixed(res),'\t',e[14].toFixed(res));   console.log(	e[ 3].toFixed(res),'\t',e[ 7].toFixed(res),'\t',    							e[11].toFixed(res),'\t',e[15].toFixed(res));   console.log('----------------------4x4 Matrix (end)----------------------\n');  }};/** * Constructor of Vector3 * If opt_src is specified, new vector is initialized by opt_src. * @param opt_src source vector(option) * JT: aVec = new Vector3(); // Makes zero-valued Vector3 *     aVec = new Vector3([5,6,7]); // sets aVec to 5,6,7 -- don't forget []!! */var Vector3 = function(opt_src) {  var v = new Float32Array(3);  if (opt_src && typeof opt_src === 'object') {    v[0] = opt_src[0]; v[1] = opt_src[1]; v[2] = opt_src[2];  }   this.elements = v;}/**  * Normalize.  * @return this  */Vector3.prototype.normalize = function() {  var v = this.elements;  // find the length of the vector:  var c = v[0], d = v[1], e = v[2], g = Math.sqrt(c*c+d*d+e*e);  if(g){              // if given vector had non-zero length,    if(g == 1)        // AND that vector length is already 1.0,        return this;  // DO NOTHING. Keep current vector contents.   } else {           // ELSE we got an empty, undefined, or zero-length vector.     v[0] = 0; v[1] = 0; v[2] = 0;  // set its elements to zero-length, and     return this;     // return   }   // Nope; we have valid vector--adjust its length to 1.0.   g = 1/g;   v[0] = c*g; v[1] = d*g; v[2] = e*g;   return this;};/** J. Tumblin 2018.02.13  * Returns the (scalar) dot-product of the two Vector3 objects  * As dot-products are commutative (order doesn't matter) then  * either of these statements will result in the same 'myDot' result:  *     myDot = aVec.dot(bVec);  // Dot product: a[0]*b[0] + a[1]*b[1] + a[2]*b[2]   *     myDot = bVec.dot(aVec);  */   Vector3.prototype.dot = function(opt_src) {  var vA = this.elements; // short-hand for the calling object  if(opt_src && typeof opt_src === 'object' && opt_src.hasOwnProperty('elements')) {    var vB = opt_src.elements;  // short-hand for the Vector3 argument    }  else {    console.log('ERROR! dot() function needs Vec3 argument! \n');    return 0.0;  }  return vA[0]*vB[0] + vA[1]*vB[1] + vA[2]*vB[2];  // compute dot-product};/** J. Tumblin 2018.02.13  * Returns Vector3 cross-product of current object and argument   * Careful! cross-products are NOT commutative! Ordering matters  *     cVec = aVec.cross(bVec);  // finds aVec x bVec  *     cVec = bVec.cross(aVec);   // finds bVec x aVec (== -aVec x bVec)  */Vector3.prototype.cross = function(opt_src) {  var vA = this.elements;   // short-hand for the calling object  var ans = new Vector3([0.0, 0.0, 0.0]);  // initialize to zero vector   var vC = ans.elements;    // get the Float32Array contents of 'ans'  if(opt_src && typeof opt_src === 'object' && opt_src.hasOwnProperty('elements')) {    var vB = opt_src.elements;  // short-hand for the Vector3 argument    }  else {    console.log('ERROR! cross() function needs Vec3 argument! \n');    return ans;  }  // compute cross-product  vC[0] = vA[1]*vB[2] - vA[2]*vB[1];  // Cx = Ay*Bz - Az*By  vC[1] = vA[2]*vB[0] - vA[0]*vB[2];  // Cy = Az*Bx - Ax*Bz  vC[2] = vA[0]*vB[1] - vA[1]*vB[0];  // Cz = Ax*By - Ay*Bx  return ans; };/** J. Tumblin 2018.02.01  * Print contents of Vector3 on console.  * If you write:    *     var aVec3 = new Vector3([7,8,9]);  *     aVec3.printMe();   // prints--  Vector3: 7.00  8.00  9.00  *     aVec3.printMe('my aVec3');  *                        // prints-- my aVec3: 7.00  8.00  9.00  */ Vector3.prototype.printMe = function(opt_src) { var res = 5;  if (opt_src && typeof opt_src === 'string') {     console.log(opt_src,':',      this.elements[ 0].toFixed(res),'\t',       this.elements[ 1].toFixed(res),'\t',       this.elements[ 2].toFixed(res),'\n');  }   else {     console.log('Vector3:',       this.elements[ 0].toFixed(res),'\t',      this.elements[ 1].toFixed(res),'\t',       this.elements[ 2].toFixed(res),'\n');  }};/** * Constructor of Vector4 * If opt_src is specified, new vector is initialized by opt_src. * @param opt_src source vector(option) */var Vector4 = function(opt_src) {  var v = new Float32Array(4);  if (opt_src && typeof opt_src === 'object') {    v[0] = opt_src[0]; v[1] = opt_src[1]; v[2] = opt_src[2]; v[3] = opt_src[3];  }   this.elements = v;}/** J. Tumblin 2018.02.13  * Returns the (scalar) dot-product of the two Vector4 objects  * As dot-products are commutative (order doesn't matter) then  * either of these statements will result in the same 'myDot' result:  *     myDot = aVec.dot(bVec);  // = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]   *     myDot = bVec.dot(aVec);  */   Vector4.prototype.dot = function(opt_src) {  var vA = this.elements; // short-hand for the calling object  if(opt_src && typeof opt_src === 'object' && opt_src.hasOwnProperty('elements')) {    var vB = opt_src.elements;  // short-hand for the Vector3 argument    }  else {    console.log('ERROR! dot() function needs Vec4 argument! \n');    return 0.0;  }  if(vA[3]*vB[3] !== 0) {    console.log('WARNING! Vector4.dot() given non-zero \'w\' values: NOT a geometric result!!');     }  return vA[0]*vB[0] + vA[1]*vB[1] + vA[2]*vB[2] + vA[3]*vB[3];  // compute dot-product};/** J. Tumblin 2018.02.13  * Returns Vector3 cross-product of current object and argument   * Careful! cross-products are NOT commutative! Ordering matters  *     cVec = aVec.cross(bVec);  // finds aVec x bVec  *     cVec = bVec.cross(aVec);   // finds bVec x aVec (== -aVec x bVec)  */Vector4.prototype.cross = function(opt_src) {  var vA = this.elements;   // short-hand for the calling object  var ans = new Vector4([0.0, 0.0, 0.0, 0.0]); // initialize to zero vector  var vC = ans.elements;    // get the Float32Array contents of 'ans'  if(opt_src && typeof opt_src === 'object' && opt_src.hasOwnProperty('elements')) {    var vB = opt_src.elements;  // short-hand for the Vector4 argument    }  else {    console.log('ERROR! cross() function needs Vec4 argument! \n');    return ans;  }  if(vA[3] !== 0 || vB[3] !== 0) {    console.log('WARNING! cross() given non-zero \'w\' values: IGNORED!!!');    }  // compute cross-product  vC[0] = vA[1]*vB[2] - vA[2]*vB[1];  // Cx = Ay*Bz - Az*By  vC[1] = vA[2]*vB[0] - vA[0]*vB[2];  // Cy = Az*Bx - Ax*Bz  vC[2] = vA[0]*vB[1] - vA[1]*vB[0];  // Cz = Ax*By - Ay*Bx  vC[3] = 0.0;    // set w == 0 ALWAYS, because it's a vector result  return ans; };/** J. Tumblin 2018.02.01  * Print contents of Vector4 on console.  * If you write:    *     var bVec4 = new Vector4([7,8,9,1]);  *     bVec4.printMe();   // prints--  Vector4: 7.00  8.00  9.00  1.00  *     bVec4.printMe('bVec4--');  *                        // prints--  bVec4--: 7.00  8.00  9.00  1.00  */Vector4.prototype.printMe = function(opt_src) { var res = 5;  if (opt_src && typeof opt_src === 'string') {      console.log(opt_src,':',     // print the string argument given.      this.elements[0].toFixed(res),'\t',       this.elements[1].toFixed(res),'\t',       this.elements[2].toFixed(res),'\t',      this.elements[3].toFixed(res),'\n');  }   else {                    // user called printMe() with NO args, so...     console.log('Vector4:',       this.elements[0].toFixed(res),'\t',      this.elements[1].toFixed(res),'\t',       this.elements[2].toFixed(res),'\t',      this.elements[3].toFixed(res),'\n');  }};/** * Additions by Adrien Katsuya Tateno * January 28, 2014 * * pushMatrix(myMat)   * Puts contents of 'myMat' matrix on top of a push-down stack * @param myMat the matrix to store * * myMat = popMatrix() * Removes the top matrix from a push-down stack * @return the matrix found at the top of the stack */ var __cuon_matrix_mod_stack = [];function pushMatrix(mat) {  __cuon_matrix_mod_stack.push(new Matrix4(mat));}function popMatrix() {  return __cuon_matrix_mod_stack.pop();}/**====================QUATERNIONS=============================================== * @author mikael emtinger / http://gomo.se/ * @author alteredq / http://alteredqualia.com/   <<== INSPIRING! visit site! * Written for the THREE.js library * * 2014.02.12 Modified by Jack Tumblin, Northwestern Univ. * 						for use in EECS 351-1 "Intro to Computer Graphics" class *						along with textbook "WebGL Programming Guide" (2013, Matsuda) *						but without the THREE.js graphics library. *	-- DROPPED original 'setFromEuler()' function because it doesn't follow the  * 			generally-accepted definition of Euler angles as described by Wikipedia. *				 */Quaternion = function( x, y, z, w ) {//--------------------------------------	this.set(		x || 0,		y || 0,		z || 0,		w !== undefined ? w : 1	);};Quaternion.prototype = {//--------------------------------------	constructor: Quaternion,	set: function ( x, y, z, w ) {					this.x = x;					this.y = y;					this.z = z;					this.w = w;		return this;	},  clear: function ( ) {//--------------------------------------	this.x = 0.0;	this.y = 0.0;	this.z = 0.0;	this.w = 1.0;	},		copy: function ( q ) {//--------------------------------------		this.x = q.x;		this.y = q.y;		this.z = q.z;		this.w = q.w;		return this;	},		printMe: function ( ) {//---------------------------------------// 2014.02:  J. Tumblin	res = 5;		// # of digits to print on HTML 'console'	console.log('Quaternion: x=', this.x.toFixed(res), 										    'i\ty=', this.y.toFixed(res), 												'j\tz=', this.z.toFixed(res), 									 'k\t(real)w=', this.w.toFixed(res),'\n');	},			setFromAxisAngle: function ( ax, ay, az, angleDeg) {//--------------------------------------// Good tutorial on rotations; code inspiration at://http://www.euclideanspace.com/maths/geometry/rotation//                          /conversions/angleToQuaternion/index.htm// Be sure we have a normalized x,y,z 'axis' argument before we start:		var mag2 = ax*ax + ay*ay + az*az;	// axis length^2		if(mag2-1.0 > 0.0000001 || mag2-1.0 < -0.0000001) {			var normer = 1.0/Math.sqrt(mag2);			ax *= normer;			ay *= normer;			az *= normer;		}		var halfAngle = angleDeg * Math.PI / 360.0;	// (angleDeg/2) * (2*pi/360)		var s = Math.sin( halfAngle );		this.x = ax * s;		this.y = ay * s;		this.z = az * s;		this.w = Math.cos( halfAngle );		return this;	},		setFromEuler: function ( alphaDeg, betaDeg, gammaDeg ) {//--------------------------------------// (Original function used non-standard definitions).// Euler angles: http://en.wikipedia.org/wiki/Euler_angles// rotate your 'current drawing axes' in 3 steps:// 1) rotate around z-axis by angle alpha //			(makes a new, 2nd set of x,y,z axes to use for//			drawing vertices. From these, we take the next step:) // 2) rotate around x-axis by angle beta//			(makes a new, 3rd set of x,y,z axes to use for//			drawing vertices.  From these, we take the next step:)// 3) rotate around z-axis (again!) by angle gamma.//			(makes a final, 4th set of x,y,z axes to use for // 			drawing vertices.  These axes are our final result. //// accepts rotations in DEGREES		console.log('NOT WRITTEN YET.  WRITE YOUR OWN.'); 		this.w = 1;	  this.x = 0;		this.y = 0;		this.z = 0;		return this;	},	setFromRotationMatrix: function ( m ) {//--------------------------------------// Adapted from: http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm		function copySign(a, b) {			return b < 0 ? -Math.abs(a) : Math.abs(a);		}		var absQ = Math.pow(m.determinant(), 1.0 / 3.0);		this.w = Math.sqrt( Math.max( 0, absQ + m.n11 + m.n22 + m.n33 ) ) / 2;		this.x = Math.sqrt( Math.max( 0, absQ + m.n11 - m.n22 - m.n33 ) ) / 2;		this.y = Math.sqrt( Math.max( 0, absQ - m.n11 + m.n22 - m.n33 ) ) / 2;		this.z = Math.sqrt( Math.max( 0, absQ - m.n11 - m.n22 + m.n33 ) ) / 2;		this.x = copySign( this.x, ( m.n32 - m.n23 ) );		this.y = copySign( this.y, ( m.n13 - m.n31 ) );		this.z = copySign( this.z, ( m.n21 - m.n12 ) );		this.normalize();		return this;	},	calculateW : function () {//--------------------------------------		this.w = - Math.sqrt( Math.abs( 		             1.0 - this.x * this.x - this.y * this.y - this.z * this.z ) );		return this;	},	inverse: function () {//--------------------------------------		this.x *= -1;		this.y *= -1;		this.z *= -1;		return this;	},	length: function () {//--------------------------------------\		return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w );	},	normalize: function () {//--------------------------------------		var len = Math.sqrt(this.x * this.x + 												this.y * this.y + 												this.z * this.z + 												this.w * this.w );		if ( len === 0 ) {			this.x = 0;			this.y = 0;			this.z = 0;			this.w = 0;		} 		else {			len = 1 / len;			this.x = this.x * len;			this.y = this.y * len;			this.z = this.z * len;			this.w = this.w * len;		}		return this;	},	multiplySelf: function ( quat2 ) {//--------------------------------------		var qax = this.x,  qay = this.y,  qaz = this.z,  qaw = this.w,		    qbx = quat2.x, qby = quat2.y, qbz = quat2.z, qbw = quat2.w;		this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;		this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;		this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;		this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;		return this;	},	multiply: function ( q1, q2 ) {//--------------------------------------// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm		this.x =  q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x;		this.y = -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y;		this.z =  q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z;		this.w = -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w;		return this;	},	multiplyVector3: function ( vec, dest ) {//--------------------------------------		if( !dest ) { dest = vec; }		var x    = vec.x,  y  = vec.y,  z  = vec.z,			 qx   = this.x, qy = this.y, qz = this.z, qw = this.w;			 		// calculate quat * vec:		var ix =  qw * x + qy * z - qz * y,				iy =  qw * y + qz * x - qx * z,				iz =  qw * z + qx * y - qy * x,				iw = -qx * x - qy * y - qz * z;		// calculate result * inverse quat:		dest.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;		dest.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;		dest.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;		return dest;	}}Quaternion.slerp = function ( qa, qb, qm, t ) {//--------------------------------------// http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/	var cosHalfTheta = qa.w * qb.w + qa.x * qb.x + qa.y * qb.y + qa.z * qb.z;	if (cosHalfTheta < 0) {		qm.w = -qb.w; 		qm.x = -qb.x; 		qm.y = -qb.y; 		qm.z = -qb.z;		cosHalfTheta = -cosHalfTheta;	} 	else {	qm.copy(qb);	}	if ( Math.abs( cosHalfTheta ) >= 1.0 ) {		qm.w = qa.w; 		qm.x = qa.x; 		qm.y = qa.y; 		qm.z = qa.z;		return qm;	}	var halfTheta = Math.acos( cosHalfTheta ),	sinHalfTheta = Math.sqrt( 1.0 - cosHalfTheta * cosHalfTheta );	if ( Math.abs( sinHalfTheta ) < 0.0001 ) {		qm.w = 0.5 * ( qa.w + qb.w );		qm.x = 0.5 * ( qa.x + qb.x );		qm.y = 0.5 * ( qa.y + qb.y );		qm.z = 0.5 * ( qa.z + qb.z );		return qm;	}	var ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta,	ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;	qm.w = ( qa.w * ratioA + qm.w * ratioB );	qm.x = ( qa.x * ratioA + qm.x * ratioB );	qm.y = ( qa.y * ratioA + qm.y * ratioB );	qm.z = ( qa.z * ratioA + qm.z * ratioB );	return qm;}