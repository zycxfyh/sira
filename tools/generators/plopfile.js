// 文件路径: tools/generators/plopfile.js
// 灵感来源: Plop (https://github.com/plopjs/plop)
// 核心理念: 基于模板的代码生成，确保代码风格一致

export default function (plop) {
  // 生成器：创建新的 AI Agent
  plop.setGenerator('agent', {
    description: '创建新的 AI Agent',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Agent 名称（如: planner, critic）:',
        validate: (value) => {
          if (!value) {
            return 'Agent 名称不能为空';
          }
          if (!/^[a-z][a-z0-9-]*$/.test(value)) {
            return 'Agent 名称必须是小写字母、数字和连字符';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Agent 描述:',
      },
      {
        type: 'list',
        name: 'location',
        message: '创建位置:',
        choices: [
          { name: 'apps/ (新应用)', value: 'apps' },
          { name: 'packages/common-backend/src/ai/ (共享模块)', value: 'shared' },
        ],
      },
    ],
    actions: [
      {
        type: 'add',
        path: '{{location}}/{{name}}-agent/src/{{name}}-agent.controller.ts',
        templateFile: 'templates/agent-controller.hbs',
      },
      {
        type: 'add',
        path: '{{location}}/{{name}}-agent/src/{{name}}.service.ts',
        templateFile: 'templates/agent-service.hbs',
      },
      {
        type: 'add',
        path: '{{location}}/{{name}}-agent/src/{{name}}-agent.module.ts',
        templateFile: 'templates/agent-module.hbs',
      },
    ],
  });

  // 生成器：创建新的 API Controller
  plop.setGenerator('controller', {
    description: '创建新的 API Controller',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Controller 名称（如: games, users）:',
      },
      {
        type: 'input',
        name: 'path',
        message: 'API 路径（如: /games, /users）:',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'apps/backend-gateway/src/{{name}}/{{name}}.controller.ts',
        templateFile: 'templates/controller.hbs',
      },
      {
        type: 'add',
        path: 'apps/backend-gateway/src/{{name}}/{{name}}.service.ts',
        templateFile: 'templates/service.hbs',
      },
      {
        type: 'add',
        path: 'apps/backend-gateway/src/{{name}}/{{name}}.module.ts',
        templateFile: 'templates/module.hbs',
      },
    ],
  });

  // 生成器：创建新的 Vue 组件
  plop.setGenerator('component', {
    description: '创建新的 Vue 组件',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: '组件名称（PascalCase）:',
      },
      {
        type: 'list',
        name: 'type',
        message: '组件类型:',
        choices: ['component', 'view', 'composable'],
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'apps/frontend/src/{{type}}s/{{pascalCase name}}.vue',
        templateFile: 'templates/vue-component.hbs',
        skipIfExists: true,
      },
    ],
  });
}
