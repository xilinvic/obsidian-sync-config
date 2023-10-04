// --dir：指定要同步的目录。如果没有指定该参数，则默认同步 snippets 目录。
// --file：指定要同步的文件。如果没有指定该参数，则默认同步 snippets 目录下的所有文件。
// --all：同步所有文件和目录，包括隐藏文件和目录。
// --exclude：指定要排除的目录。默认情况下，排除了 .obsidian、.Trash 和 .history 目录。
// --clear：在同步前清空目标目录。
// --force：无论源目录和目标目录是否相同，都强制同步。

const fs = require('fs');
const path = require('path');

const successLogs = [];
const errorLogs = [];

const rootDir = process.cwd();

function ensureTargetDir(dirPath) {
	// if (fs.existsSync(dirPath)) {
	//     return;
	// }
	// const parentDir = path.dirname(dirPath);
	// if (parentDir !== dirPath) {
	//     ensureTargetDir(parentDir);
	// }
	// fs.mkdirSync(dirPath);
	if (!fs.existsSync(path.dirname(dirPath))) {
		fs.mkdirSync(path.dirname(dirPath), { recursive: true });
	}
}

function syncFile(sourcePath, targetPath, force) {
	if (!fs.existsSync(path.dirname(targetPath))) {
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	}
	try {
		const sourceContent = fs.readFileSync(sourcePath);
		const targetContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null;
		if (
			force ||
			!targetContent ||
			(sourceContent !== null &&
				targetContent !== null &&
				Buffer.compare(sourceContent, targetContent) !== 0)
		) {
			fs.copyFileSync(sourcePath, targetPath);
			const successLog = `Sync ${sourcePath.slice(rootDir.length)} to ${targetPath.slice(
				rootDir.length,
			)}`;
			console.log(successLog);
			successLogs.push(successLog);
		}
	} catch (err) {
		errorLogs.push(
			`Failed to sync ${sourcePath.slice(rootDir.length)} to ${targetPath}: ${err.message}`,
		);
	}
}

function syncDir(sourceDir, targetDir, force) {
	const stats = fs.statSync(sourceDir);
	if (stats.isFile()) {
		const sourcePath = sourceDir;
		ensureTargetDir(targetDir.slice(0, -path.basename(sourceDir).length));
		syncFile(sourcePath, targetDir, force);
		return;
	}

	const files = fs.readdirSync(sourceDir);
	for (const file of files) {
		const sourcePath = path.join(sourceDir, file);
		const targetPath = path.join(targetDir, file);

		const stats = fs.statSync(sourcePath);
		if (stats.isDirectory()) {
			ensureTargetDir(targetPath);
			syncDir(sourcePath, targetPath, force);
		} else {
			syncFile(sourcePath, targetPath, force);
		}
	}
}

function clearDir(dir) {
	if (!fs.existsSync(dir)) {
		return;
	}

	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stats = fs.statSync(filePath);
		if (stats.isDirectory()) {
			clearDir(filePath);
		} else {
			fs.unlinkSync(filePath);
			console.log(`Deleted ${filePath.slice(rootDir.length)}`);
		}
	}

	if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
		fs.rmdirSync(dir);
	}
}

function sync(sourceDirs, targetDirs, clearBeforeSync = false, force = false) {
	for (const sourceDir of sourceDirs) {
		for (const targetDir of targetDirs) {
			const sourceDir2 = path.join(rootDir, sourceDir);
			const targetDir2 = path.join(rootDir, targetDir, sourceDir);

			if (clearBeforeSync) {
				clearDir(targetDir2);
			}

			syncDir(sourceDir2, targetDir2, force);
		}
	}
}

const args = process.argv.slice(2);
if (
	args.length === 0 ||
	(args.length === 1 && (args.includes('--clear') || args.includes('--force')))
) {
	args.push('--dir', 'snippets');
}

function getDirs(args) {
	const sourceDirs = [];
	if (args.includes('--dir')) {
		const index = args.indexOf('--dir');
		sourceDirs.push(path.join('.obsidian', args[index + 1]));
	} else if (args.includes('--file')) {
		const index = args.indexOf('--file');
		sourceDirs.push(path.join('.obsidian', args[index + 1]));
	} else if (args.includes('--all')) {
		sourceDirs.push('.obsidian');
	}

	const excludeDirs = ['.obsidian', '.Trash', '.history'];
	if (args.includes('--exclude')) {
		const index = args.indexOf('--exclude');
		excludeDirs.push(args[index + 1]);
	}

	const targetDirs = fs.readdirSync(rootDir).filter(dir => {
		const stats = fs.statSync(dir);
		return stats.isDirectory() && !excludeDirs.includes(dir);
	});

	return [sourceDirs, targetDirs];
}

const [sourceDirs, targetDirs] = getDirs(args);
const clearBeforeSync = args.includes('--clear');
const force = args.includes('--force');

sync(sourceDirs, targetDirs, clearBeforeSync, force);

console.log(
	`Sync completed. ${successLogs.length} files synced successfully, ${errorLogs.length} files failed to sync.`,
);
if (errorLogs.length > 0) {
	console.log(`Error logs:\n${errorLogs.join('\n')}`);
}
