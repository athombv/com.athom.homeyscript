# HomeyScript

Write scripts for Homey, for when the Flow Editor might not be enough.

Visit [https://homeyscript.athom.com](https://homeyscript.athom.com) to manage your scripts.

## Features

* Write a script in JavaScript and have direct access to Homey's Web API (bèta)
* Run a script as a Flow 'and' or 'then' card

## Documentation
In HomeyScript, you can access a few global objects:

* `Homey` - A HomeyAPI instance. [https://developer.athom.com/](https://developer.athom.com/docs/api)
* `_` - Lodash. [https://lodash.com/](https://lodash.com/docs/4.17.4)
* `fetch` - The Fetch API. [https://developer.mozilla.org/](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
* `setTagValue(id, opts, value)` - Create, edit, remove a flow tag. Use undefined to remove the tag. [https://developer.athom.com/](https://developer.athom.com/docs/apps/FlowToken.html)
* `console` - V8 Logging API's.
* `log(...args)` - A shortcut function to append to the output log.
* `say(text)` - A shortcut function to make Homey speak.
* `__filename__` - The script filename.
* `__script_id__` - The script ID.
* `args` - An (optional) Array of script args.

## API
It is possible to trigger a script remotely using the Homey Web API.
```
let HomeyScript = await Homey.apps.getApp({id:'com.athom.homeyscript'});
HomeyScript.apiPost('script/<ScriptID>/run', [arg1, arg2]);

```

## Changelog

*Version 1.0.5*

Minor back-end changes.

Web API update to version 2.0.138

*Version 1.0.4*

Fix a bug that caused an exception to be thrown when accessing app api's

Web API update to version 2.0.95

*Version: 1.0.3*

It is now possible to use flow tags in HomeyScript, added an example of this createDayTag.js.

Web API update to version 2.0.94


_Note: This app is the result of one of Athom's Hacky Fridays, so official support is not available._
