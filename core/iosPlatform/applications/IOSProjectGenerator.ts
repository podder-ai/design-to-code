import * as fs from 'fs-extra';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { OSType } from '../../domain/entities/OSType';
import { PathManager, OutputType } from '../../utilities/PathManager';
import { HandlebarsHelpers } from '../../utilities/HandlebarsHelpers';
import { ElementType } from '../../domain/entities/ElementType';

dotenv.config();
if (dotenv.error) {
  throw dotenv.error;
}

class XcAssetJsonPaths {
  intermediate: string;
  last: string;
}

export class IOSProjectGenerator {
  private pathManager: PathManager;
  private projectTemplateRootDir: string;

  constructor(outputDir?: string) {
    this.pathManager = new PathManager(outputDir);
    const templatePath = path.isAbsolute(process.env.TEMPLATE_DIR)
      ? process.env.TEMPLATE_DIR
      : path.resolve(process.cwd(), process.env.TEMPLATE_DIR);
    this.projectTemplateRootDir = path.join(
      templatePath,
      OSType.ios,
      'XcodeProjectTemplate',
    );
  }

  generate(projectName: string): void {
    if (
      !projectName ||
      projectName.length <= 0 ||
      projectName.trim().length <= 0
    ) {
      throw new Error('project name is empty');
    }
    const trimedProjectName = projectName.trim();
    const templateDestDir = this.pathManager.getOutputPath(
      OutputType.sourcecodes,
      true,
      OSType.ios,
      'XcodeProject',
    );

    // remove all files first
    fs.removeSync(templateDestDir);

    // copy directory to geenerated
    fs.copySync(this.projectTemplateRootDir, templateDestDir);

    // rename top directory names
    this.renameDirectories(templateDestDir, trimedProjectName);

    const projectNameData = { projectName: trimedProjectName };

    // deal with project.yml
    this.searchAndAdoptTemplate(
      templateDestDir,
      `project\.yml\.hbs`,
      projectNameData,
    );

    // deal with *Tests directories
    this.searchAndAdoptTemplate(
      templateDestDir,
      'Tests.*hbs$',
      projectNameData,
    );

    // deal with assets
    this.generateAssets(templateDestDir);

    // const vcTemplatePath: string = path.join(
    //   this.projectTemplateRootDir,
    //   'viewController.hbs',
    // );
    // const vcTemplate = this.compiledTemplate(vcTemplatePath);

    // const containers: any[] = sketchData.filter(
    //   element =>
    //     element.id &&
    //     element.type &&
    //     element.type === <string>ElementType.Container,
    // );

    // let outputs = [];
    // let vcNames: Object[] = [];
    // for (const container of containers) {
    //   const views = sketchData.filter(
    //     element => element.containerId && element.containerId === container.id,
    //   );

    //   let containerObj = {
    //     container: container,
    //     views: views,
    //   };
    //   const output = vcTemplate(containerObj);
    //   const vcFilePath = this.pathManager.getOutputPath(
    //     OutputType.sourcecodes,
    //     true,
    //     OSType.ios,
    //     container.name + 'ViewController.swift',
    //   );
    //   outputs.push({ filePath: vcFilePath, content: output });
    //   vcNames.push({ name: path.parse(vcFilePath).name });
    // }

    // // viewController毎にviewを書き出し
    // for (const output of outputs) {
    //   fs.writeFileSync(output.filePath, output.content);
    // }

    // // 各viewControllerを確認するためのviewControllerを書き出し
    // const baseVcFilePath = this.pathManager.getOutputPath(
    //   OutputType.sourcecodes,
    //   true,
    //   OSType.ios,
    //   'ViewController.swift',
    // );
    // const baseVcTemplatePath: string = path.join(
    //   this.templateDir,
    //   'baseViewController.hbs',
    // );
    // const baseVcTemplate = this.compiledTemplate(baseVcTemplatePath);
    // const baseVcOutput = baseVcTemplate({ viewControllers: vcNames });
    // fs.writeFileSync(baseVcFilePath, baseVcOutput);
  }

  /**
   * Private methods
   */

  /**
   *
   * @param directory directory to rename
   * @param toName name directory to be changed
   * @param recursive if true, recursively rename. default true.
   * @return void
   */
  private renameDirectories(
    directory: string,
    toName: string,
    renameFile: boolean = true,
    recursive: boolean = true,
  ): void {
    if (!PathManager.isDir(directory)) return;

    let dirContents: string[] = fs.readdirSync(directory);
    dirContents
      .filter(dirOrFile => {
        const isDir = PathManager.isDir(path.join(directory, dirOrFile));
        const nameMatched = dirOrFile.match(/projectName/g);
        return isDir && nameMatched;
      })
      .forEach(matchedDirName => {
        const newDirName = matchedDirName.replace(/projectName/g, toName);
        const origDir = path.join(directory, matchedDirName);
        const newDir = path.join(directory, newDirName);
        fs.moveSync(origDir, newDir, { overwrite: true });

        if (renameFile) {
          this.renameFiles(newDir, toName);
        }
        if (recursive) {
          this.renameDirectories(
            path.join(directory, newDirName),
            toName,
            recursive,
          );
        }
      });
  }

  private renameFiles(directory: string, toName: string): void {
    if (!PathManager.isDir(directory)) return;

    let dirContents: string[] = fs.readdirSync(directory);
    dirContents
      .filter(dirOrFile => {
        const isDir = PathManager.isDir(path.join(directory, dirOrFile));
        const nameMatched = dirOrFile.match(/projectName/g);
        return !isDir && nameMatched;
      })
      .forEach(matchedFileName => {
        const newFileName = matchedFileName.replace(/projectName/g, toName);
        const origFile = path.join(directory, matchedFileName);
        const newFile = path.join(directory, newFileName);
        fs.moveSync(origFile, newFile, { overwrite: true });
      });
  }

  private searchAndAdoptTemplate(
    searchDir: string,
    regExpStr: string,
    data: Object,
  ): void {
    const templatePaths = this.searchDirsOrFiles(searchDir, regExpStr, true);
    if (!templatePaths || templatePaths.length <= 0) return;

    templatePaths.forEach(filePath => {
      const template = this.compiledTemplate(filePath);
      const output = template(data);
      const sliceCnt = path.parse(filePath).ext.length;
      const newPath = filePath.slice(0, -sliceCnt);

      fs.removeSync(filePath);
      fs.writeFileSync(newPath, output);
    });
  }

  private searchDirsOrFiles(
    searchDir: string,
    regExp: string,
    recursive: boolean,
  ): string[] | null {
    if (!PathManager.isDir(searchDir)) return null;

    let foundPaths: string[] = [];
    const dirContents = fs.readdirSync(searchDir);
    dirContents
      .filter(dirOrFile => {
        const isDir = PathManager.isDir(path.join(searchDir, dirOrFile));
        const isMatched = dirOrFile.match(new RegExp(regExp, 'g'));
        if (isDir && recursive) {
          const paths = this.searchDirsOrFiles(
            path.join(searchDir, dirOrFile),
            regExp,
            isDir,
          );
          if (paths && paths.length > 0) {
            paths.forEach(path => foundPaths.push(path));
          }
        }
        return isMatched;
      })
      .forEach(fileName => {
        const filePath = path.join(searchDir, fileName);
        foundPaths.push(filePath);
      });

    return foundPaths;
  }

  private generateAssets(searchDir: string): void {
    if (!PathManager.isDir(searchDir)) return;

    // Prepare needed paths/directories
    const jsonTemplatePaths = this.getAssetJsonTemplatePaths();
    const destDirs = this.searchDirsOrFiles(searchDir, `xcassets$`, true);
    if (!destDirs || destDirs.length <= 0) {
      throw new Error('no xcassets directory within template.');
    }
    const destDir = path.join(destDirs[0], 'DtcGenerated');
    fs.ensureDirSync(destDir);

    // remove unneeded directories
    fs.removeSync(path.join(destDirs[0], 'intermediateDirectory'));

    /**
     * Place inermediate json on top of assets generated directory
     */
    fs.copyFileSync(
      jsonTemplatePaths.intermediate,
      path.join(destDir, 'Contents.json'),
    );

    /*
     * Copy icons(slices) 
     */
    const slicesDir = this.pathManager.getOutputPath(OutputType.slices);

    const slices: string[] = fs.readdirSync(slicesDir);
    if (!slices || slices.length <= 0) {
      return;
    }
    slices.forEach(basename => {
      this.generateXcAssets(
        path.join(slicesDir, basename),
        destDir,
        jsonTemplatePaths,
      );
    });

    /* 
     * Copy images
     */
    // will be generated like below:
    // images/Contents.json
    // images/1e02fxxxxxxxxxxxxx.imageset/Contents.json
    // images/1e02fxxxxxxxxxxxxx.imageset/1e02fxxxxxxxxxxxxx.png
    const imagesDir = this.pathManager.getOutputPath(
      OutputType.images,
      false,
      OSType.ios,
    );
    this.generateXcAssets(imagesDir, destDir, jsonTemplatePaths);
  }

  private generateXcAssets(
    originPath: string,
    destDirOrPath: string,
    templatePaths: XcAssetJsonPaths,
  ): void {
    /*
      filepath の場合、以下を作成:
        filename.imageset/Contents.json
        filename.imageset/filename.ext

      directory path の場合、以下を作成:
        dirname/
        dirname/Contents.json (namespace記載のやつ)
    */
    const lastJsonTemplate = this.compiledTemplate(templatePaths.last);

    /* deal with directory pathes below */
    if (PathManager.isDir(originPath)) {
      const intermediateDirPath = path.join(
        destDirOrPath,
        path.basename(originPath),
      );
      // create intermediate directory if needed
      fs.ensureDirSync(intermediateDirPath);

      // create intermediate json
      const intermediateJsonPath = path.join(
        intermediateDirPath,
        'Contents.json', // intermediate json
      );
      fs.copyFileSync(templatePaths.intermediate, intermediateJsonPath);

      const components: string[] = fs.readdirSync(originPath);
      components.forEach(component => {
        const newOrigPath = path.join(originPath, component);
        this.generateXcAssets(newOrigPath, intermediateDirPath, templatePaths);
      });
      return;
    }

    /* deal with file pathes below */
    const parsed = path.parse(originPath);
    const imageSetDir = path.join(destDirOrPath, parsed.name + '.imageset');
    // create imageSetDir directory if needed
    fs.ensureDirSync(imageSetDir);

    // create last directory json
    const lastJsonStr = lastJsonTemplate({ filename: parsed.base });
    fs.writeFileSync(path.join(imageSetDir, 'Contents.json'), lastJsonStr);

    // copy asset data itself
    fs.copyFileSync(originPath, path.join(imageSetDir, parsed.base));
  }

  private getMetadataJson(): any {
    const metadataJsonPath = this.pathManager.getOutputPath(
      OutputType.metadata,
    );
    if (!metadataJsonPath) {
      throw new Error('cannot find directory: ' + metadataJsonPath);
    }
    const json: any[] = JSON.parse(this.pathManager.read(metadataJsonPath));
    if (!json) {
      throw new Error('cannot find directory: ' + metadataJsonPath);
    }
    return json;
  }

  private getAssetJsonTemplatePaths(): XcAssetJsonPaths {
    const assetsDir = this.searchDirsOrFiles(
      this.projectTemplateRootDir,
      'xcassets$',
      true,
    );
    if (!assetsDir || assetsDir.length <= 0) {
      throw new Error('no .xcassets template directory');
    }

    const templatePaths: XcAssetJsonPaths = new XcAssetJsonPaths();
    const interMediateJsonPath = path.join(
      assetsDir[0],
      'intermediateDirectory',
      'midDirContents.json',
    );
    const lastJsonPath = path.join(
      assetsDir[0],
      'intermediateDirectory',
      'iconName.imageset',
      'lastDirContents.json.hbs',
    );
    templatePaths.intermediate = interMediateJsonPath;
    templatePaths.last = lastJsonPath;
    return templatePaths;
  }

  private compiledTemplate(templatePath: string): any {
    const templateStr = this.pathManager.read(templatePath);
    if (!templateStr) {
      throw new Error("couldn't get template: " + templatePath);
    }
    return HandlebarsHelpers.handlebars().compile(String(templateStr));
  }
}
