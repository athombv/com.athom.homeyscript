'use strict';

class WidgetHost {
  static controller(Homey, scriptId, refresh) {
    return new globalThis.WidgetInteractionController({
      dispatch: async (intent) => {
        return await Homey.api('POST', '/action', { scriptId, ...intent });
      },
      refresh,
    });
  }
}

globalThis.WidgetHost = WidgetHost;
