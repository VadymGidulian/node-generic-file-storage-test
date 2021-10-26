# 🗄️ generic-file-storage

Generic file storage: stores files and their variants.

## 🎯 Motivation

This module is designed to be a simple and easily extendible file storage solution.

## ✨ Features

- Simple API
- Flexible configuration
- Generates variants
- Requires no external storage

## 📝 Usage

System requirements: `/etc/mime.types`, `file`

```js
const GenericFileStorage = require('@vadym.gidulian/generic-file-storage');

// Create storage interface object
const storage = new GenericFileStorage({
	// Storage's root path.
	path: 'path/to/storage',
	// Generated variants. (Optional)
	variants: [
		{
			// Variant name.
			name: 'preview',
			// Custom fields
			length: 60
		},
		...
	],
	// or
	variants({
		// Detected file's format.
		// Ex.: `jpeg`, `mp3`, `mp4`, `txt`, etc.
		format,
		// Detected file's media type (MIME type).
		// Ex.: `image/jpeg`, `audio/mpeg`, `video/mp4`, `text/plain`, etc.
		mediaType,
		// File's size in bytes.
		size
	}) {
		if ((mediaType === 'plain/text') && (size > 512)) {
			return [
				{name: 'preview', length: 60}
			];
		} else if (...) {
			...
		} else {
			return [];
		}
	}
});

// Save an image to the storage and create thumbnails
const fileId = await storage.saveImage(buffer);
// or
// Save an image to the storage and don't create thumbnails
const fileId = await storage.saveImage(buffer, {resize: false});
// or
// Save an image to the storage and don't wait for thumbnails
const fileId = await storage.saveImage(buffer, {resize: 'async'});
// '01234567-89ab-cdef-0123-456789abcdef.jpeg'


// Get image's metadata
const metadata = await storage.getImageMetadata(fileId);
// {
//     format:    'jpeg',
//     mediaType: 'image/jpeg',
//     size:      131072,
//     width:     512,
//     height:    512
// }

// Get image's path
const imagePath = await storage.getImagePath(fileId);
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.jpeg'

const thumbnailPath = await storage.getImagePath(fileId, 'md');
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.md.jpeg'
const thumbnailPath = await storage.getImagePath(fileId, 'xs');
// null
const thumbnailPath = await storage.getImagePath(fileId, 'xs', {fallback: 'sm'});
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.sm.jpeg'
// or
const thumbnailPath = await storage.getImagePath(fileId, 'xs', {fallback: ['sm', 'md']});
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.sm.jpeg'
// or
const thumbnailPath = await storage.getImagePath(fileId, 'xs', {fallback: true});
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.jpeg'


// Convert the image to the specified format
const newFileId = await storage.convertImage(fileId, 'webp');
// or
const newFileId = await storage.convertImage(fileId, 'webp', {resize: ...});
// '01234567-89ab-cdef-0123-456789abcdef.webp'


// Regenerate image's thumbnails
await storage.resizeImage(fileId);
// or
// Regenerate image's thumbnails, removing existing before
await storage.resizeImage(fileId, {clean: true});
storage.on('resize', ({
	// Image's id.
	id,
	// Array of successfully resized thumbnail names.
	resized,
	// Number of errors arisen during resize.
	errors
}) => {...});
storage.on('resizeProgress', ev => {...}); // The same as `resize` but emitted after each thumbnail
storage.on('resizeError', err => {...});


// Regenerate thumbnails for all images
await storage.resizeAllImages();
// or
// Regenerate thumbnails for all images, removing existing before
await storage.resizeAllImages({clean: true});
storage.on('resizeAll', ({
	// Number of successfully resized images.
	resized,
	// Total number of images to resize.
	total
}) => {...});
storage.on('resizeAllProgress', ({
	// Last successfully resized image id.
	id,
	// Number of successfully resized images.
	resized,
	// Total number of images to resize.
	total
}) => {...});


// Delete the image and its thumbnails
await storage.deleteImage(fileId);
```
¹ [Image geometry](https://imagemagick.org/script/command-line-processing.php#geometry)

### Caveats

#### Animated images

It can't convert between animated image formats: only the first frame is extracted and converted.
