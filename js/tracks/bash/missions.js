/* Bash track: levels, missions, checks, hint-1 diagnosis and mistake detectors.
   Missions share one evolving fake disk, so they run in this exact order.
   Every check validates the effect (files, output), not the literal command. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const S = OT.bashSim;
  const { f, dir, getNode, resolvePath, walkAll, basename, displayPath, FAKE_DATE } = S;

  /* ---- check helpers ---- */
  const exists = (fs, path) => getNode(fs, resolvePath([], path));
  const contentOf = (fs, path) => { const n = exists(fs, path); return n && n.type === 'file' ? n.content : null; };
  const execFlag = (fs, path) => { const n = exists(fs, path); return n ? !!n.exec : false; };
  function setEq(a, b) {
    if (a.length !== b.length) return false;
    const sa = a.slice().sort(), sb = b.slice().sort();
    return sa.every((v, i) => v === sb[i]);
  }
  const namesOf = node => Object.keys(node.children).sort().map(n => node.children[n].type === 'dir' ? n + '/' : n);
  const lastSeg = p => p.split('/').filter(Boolean).pop() || '';
  const allPathsWithExt = (fs, ext) => walkAll(fs, [])
    .filter(e => e.node.type === 'file' && basename(e.segs).endsWith(ext)).map(e => './' + e.segs.join('/'));
  function wcCount(stdout) {
    const n = parseInt((stdout || '').trim().split(/\s+/)[0], 10);
    return Number.isFinite(n) ? n : null;
  }
  const lines = s => (s || '').split('\n').map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const sameLines = (a, b) => setEq(lines(a), lines(b));
  const sameOrdered = (a, b) => { const x = lines(a), y = lines(b); return x.length === y.length && x.every((v, i) => v === y[i]); };
  const stripLabels = s => (s || '').split('\n').map(l => l.replace(/^[^\s:]*\.log:/, '')).join('\n');
  // Expected output of a read-only command, computed on a copy of the current disk.
  const expected = (st, cmd) => S.runLine(cmd, S.cloneState(st)).stdout;
  const ok = res => !res.error;

  const home = st => { st.cwd = []; };
  const at = (...segs) => st => { st.cwd = segs; };

  /* ---- missions ---- */
  // fields: id, title, brief, concept (hint 2), skeleton (hint 3), solution {cmd, parts}, check, setup?, partial?, note?, mistakes?
  const L1 = [
    { id: 'pwd', title: 'Where are you?', setup: home,
      brief: 'First day at the office. A coworker asks: "which folder are you in right now?" Print your current location.',
      concept: 'The command is the initials of "print working directory". It takes no arguments.',
      skeleton: 'p__',
      solution: { cmd: 'pwd', parts: [['pwd', 'Prints the full path of the folder you are in.']] },
      check: (res, st) => ok(res) && res.stdout.trim() === displayPath(st.cwd) },

    { id: 'ls', title: "What's in here?", setup: home,
      brief: 'List everything in the current folder.',
      concept: 'Short for "list": it shows what a folder contains. With no arguments it uses the current folder; folders end with a /.',
      skeleton: 'l_',
      solution: { cmd: 'ls', parts: [['ls', 'Lists the contents of the current folder.']] },
      check: (res, st) => ok(res) && setEq(lines(res.stdout), namesOf(getNode(st.fs, st.cwd))) },

    { id: 'cd-photos', title: 'Step into photos', setup: home,
      brief: 'Move into the photos folder.',
      concept: '"cd" (change directory) moves you to another folder. The folder name comes right after it.',
      skeleton: 'cd <folder>',
      solution: { cmd: 'cd photos', parts: [['cd', 'Changes folder.'], ['photos', 'The folder to go into.']] },
      check: (res, st) => setEq(st.cwd, ['photos']) },

    { id: 'cd-up', title: 'One step back', setup: at('photos'),
      brief: "You're inside photos. Go up one level, to the folder that contains it.",
      concept: 'Two dots (..) mean "the folder above this one". One dot (.) means "this folder".',
      skeleton: 'cd __',
      solution: { cmd: 'cd ..', parts: [['cd', 'Changes folder.'], ['..', 'The parent folder.']] },
      check: (res, st) => st.cwd.length === 0 },

    { id: 'cd-home', title: 'Straight home', setup: at('reports', 'archive'),
      brief: 'You wandered deep into reports/archive. Get back to your home folder in one command, however deep you are.',
      concept: 'cd with no argument at all always takes you to your home folder, from anywhere.',
      skeleton: 'c_',
      solution: { cmd: 'cd', parts: [['cd', 'With no arguments, goes back to your home folder (~).']] },
      check: (res, st) => st.cwd.length === 0 },

    { id: 'cat-relative', title: 'No detour needed', setup: home,
      brief: 'Show the contents of notes/todo.txt without moving into the notes folder: you should stay where you are.',
      concept: 'You can point at a file inside a folder by writing folder/file (a relative path). The command that prints a file is cat.',
      skeleton: 'cat <folder>/<file>',
      solution: { cmd: 'cat notes/todo.txt', parts: [['cat', 'Prints a file.'], ['notes/todo.txt', 'Relative path: todo.txt inside notes.']] },
      check: (res, st) => ok(res) && st.cwd.length === 0 && res.stdout.trim() === (contentOf(st.fs, 'notes/todo.txt') || '').trim(),
      mistakes: [{ id: 'cd-not-needed', label: 'Using cd when a path was enough', test: (res, st) => st.cwd.length > 0,
        tip: 'No need to move for this one: a folder/file path gets there on its own. Go back with cd and try again.' }] },

    { id: 'ls-folder', title: 'Peek without moving', setup: home,
      brief: "See what's inside reports without moving into it.",
      concept: 'ls accepts a folder as an argument: it lists that folder without you having to go there.',
      skeleton: 'ls <folder>',
      solution: { cmd: 'ls reports', parts: [['ls', 'Lists contents.'], ['reports', 'The folder to list (no need to be inside).']] },
      check: (res, st) => ok(res) && st.cwd.length === 0 && setEq(lines(res.stdout), namesOf(getNode(st.fs, ['reports']))),
      mistakes: [{ id: 'cd-not-needed', label: 'Using cd when a path was enough', test: (res, st) => st.cwd.length > 0,
        tip: "No need to go in: ls can look at another folder from where you are. Go back with cd and try again." }] },

    { id: 'cd-nested', title: 'Two steps in one', setup: home,
      brief: 'Go straight into reports/archive with a single cd (no two cds in a row).',
      concept: 'Paths chain with /: folder/subfolder.',
      skeleton: 'cd <folder>/<subfolder>',
      solution: { cmd: 'cd reports/archive', parts: [['cd', 'Changes folder.'], ['reports/archive', 'A two-level path in one go.']] },
      check: (res, st) => setEq(st.cwd, ['reports', 'archive']) },

    { id: 'mkdir', title: 'Your workspace', setup: home,
      brief: 'Create a new, empty folder called drafts.',
      concept: 'mkdir ("make directory") creates folders. The new folder name comes after it.',
      skeleton: 'mkdir <name>',
      solution: { cmd: 'mkdir drafts', parts: [['mkdir', 'Creates a folder.'], ['drafts', 'The new folder name.']] },
      check: (res, st) => { const n = exists(st.fs, 'drafts'); return !!n && n.type === 'dir'; } },

    { id: 'touch', title: 'A first draft', setup: st => { home(st); if (!exists(st.fs, 'drafts')) st.fs.children.drafts = dir({}); },
      brief: 'Create an empty file called draft1.txt inside the drafts folder.',
      concept: 'touch creates an empty file (if it already exists, nothing breaks). You can give it a folder/file path.',
      skeleton: 'touch <folder>/<file>',
      solution: { cmd: 'touch drafts/draft1.txt', parts: [['touch', 'Creates an empty file.'], ['drafts/draft1.txt', 'Where, and with what name.']] },
      check: (res, st) => { const n = exists(st.fs, 'drafts/draft1.txt'); return !!n && n.type === 'file'; } },

    { id: 'cp', title: 'Backup copy', setup: home,
      brief: 'Make a backup of notes.txt called notes_backup.txt. The original must still be there afterwards.',
      concept: 'cp ("copy") duplicates a file: first the original, then the name of the copy. The original is untouched.',
      skeleton: 'cp <source> <destination>',
      solution: { cmd: 'cp notes.txt notes_backup.txt', parts: [['cp', 'Copies a file.'], ['notes.txt', 'The original.'], ['notes_backup.txt', 'The name of the copy.']] },
      check: (res, st) => { const o = contentOf(st.fs, 'notes.txt'); return o !== null && o === contentOf(st.fs, 'notes_backup.txt'); },
      mistakes: [{ id: 'mv-instead-of-cp', label: 'Using mv when a copy was needed', test: (res, st, input) => /^\s*mv\b/.test(input),
        tip: 'mv moves the file: the original disappears. Click "Restore files" (above the terminal) and try the command that duplicates.' }] },

    { id: 'mv', title: 'Rename the draft',
      setup: st => {
        home(st);
        if (!exists(st.fs, 'drafts')) st.fs.children.drafts = dir({});
        if (!exists(st.fs, 'drafts/draft1.txt') && !exists(st.fs, 'drafts/intro.txt')) st.fs.children.drafts.children['draft1.txt'] = f('');
      },
      brief: 'Inside drafts, rename draft1.txt to intro.txt.',
      concept: 'mv ("move") moves or renames: the current name, then the new one. The file is inside drafts, so both paths start with drafts/.',
      skeleton: 'mv <folder>/<old name> <folder>/<new name>',
      solution: { cmd: 'mv drafts/draft1.txt drafts/intro.txt', parts: [['mv', 'Moves or renames.'], ['drafts/draft1.txt', 'The current file.'], ['drafts/intro.txt', 'Its new name (same folder).']] },
      check: (res, st) => !exists(st.fs, 'drafts/draft1.txt') && !!exists(st.fs, 'drafts/intro.txt') },

    { id: 'rm', title: 'Clean up', setup: st => { home(st); if (!exists(st.fs, 'old.log')) st.fs.children['old.log'] = f('x\n'); },
      brief: 'Delete the file old.log, it is no longer needed.',
      concept: 'rm ("remove") deletes files. There is no trash bin: deleted means gone.',
      skeleton: 'rm <file>',
      solution: { cmd: 'rm old.log', parts: [['rm', 'Deletes a file.'], ['old.log', 'The file to delete.']] },
      check: (res, st) => !exists(st.fs, 'old.log') },

    { id: 'cat', title: 'Read a file', setup: home,
      brief: 'Print the contents of readme.txt on screen.',
      concept: 'cat prints the whole file; less shows it page by page (press q to quit). Either works.',
      skeleton: 'cat <file>',
      solution: { cmd: 'cat readme.txt', parts: [['cat', 'Prints the contents.'], ['readme.txt', 'The file.']] },
      check: (res, st) => ok(res) && res.stdout.trim() === (contentOf(st.fs, 'readme.txt') || '').trim() },
  ];

  const L2 = [
    { id: 'grep-basic', title: 'Someone mentioned an invoice', setup: at('reports'),
      brief: "You're in reports. One of these files mentions the word \"invoice\": find which one without opening them one by one.",
      concept: 'grep searches for text inside files and prints the matching lines. The wildcard *.txt means "every .txt here".',
      skeleton: 'grep <word> <files>',
      solution: { cmd: 'grep invoice *.txt', parts: [['grep', 'Searches text inside files.'], ['invoice', 'The word to look for.'], ['*.txt', 'Which files: every .txt in the folder.']] },
      check: res => ok(res) && res.stdout.includes('invoice') },

    { id: 'grep-i', title: "Case doesn't matter", setup: at('reports'),
      brief: 'Someone wrote "vendor" in these reports, but you don\'t know how they capitalized it. Find it anyway.',
      concept: 'grep is case-sensitive. An option (-i, "ignore case") makes it stop caring.',
      skeleton: 'grep -_ <word> <file(s)>',
      solution: { cmd: 'grep -i vendor q2.txt', parts: [['grep', 'Searches text.'], ['-i', 'Ignores upper/lower case.'], ['vendor', 'The word.'], ['q2.txt', 'The file (*.txt works too).']] },
      check: res => ok(res) && res.stdout.length > 0 && res.stdout.toLowerCase().includes('vendor') },

    { id: 'grep-r', title: 'It could be anywhere', setup: home,
      brief: 'Somewhere in your folder (maybe in a subfolder) there is a message marked URGENT. Find it without opening folder after folder.',
      concept: 'To make grep walk through folders and subfolders use -r ("recursive"). The last argument is the folder to search (. = the current one).',
      skeleton: 'grep -_ <word> <folder>',
      solution: { cmd: 'grep -r URGENT .', parts: [['grep', 'Searches text.'], ['-r', 'Goes into every subfolder.'], ['URGENT', 'The exact word, uppercase.'], ['.', 'Starts at the current folder.']] },
      check: res => ok(res) && res.stdout.includes('URGENT') },

    { id: 'grep-ri', title: 'Both at once', setup: home,
      brief: "Now you know neither the folder nor the spelling: find every mention of \"urgent\" on your whole disk.",
      concept: 'Options combine: separate (-r -i) or glued together (-ri).',
      skeleton: 'grep -__ <word> <folder>',
      solution: { cmd: 'grep -ri urgent .', parts: [['grep', 'Searches text.'], ['-ri', '-r walks subfolders and -i ignores case.'], ['urgent', 'The word.'], ['.', 'From the current folder.']] },
      check: res => ok(res) && res.stdout.length > 0 && res.stdout.toLowerCase().includes('urgent') },

    { id: 'find-name', title: 'A very specific file', setup: home,
      brief: 'There is a file named exactly budget.csv somewhere. Find where it lives.',
      concept: 'find searches files by name: first the folder to start from, then -name and the name.',
      skeleton: 'find <folder> -name <name>',
      solution: { cmd: 'find . -name budget.csv', parts: [['find', 'Searches files and folders.'], ['.', 'Starts here and goes down every folder.'], ['-name budget.csv', 'Exactly that name.']] },
      check: res => ok(res) && res.stdout.includes('budget.csv') },

    { id: 'find-wildcard', title: 'Every .txt file', setup: home,
      brief: 'List every .txt file on your disk using a wildcard, without naming them one by one.',
      concept: 'In -name the pattern can contain * ("anything"). Put it in quotes so bash leaves it alone.',
      skeleton: 'find <folder> -name "*.<extension>"',
      solution: { cmd: 'find . -name "*.txt"', parts: [['find .', 'Searches from the current folder.'], ['-name "*.txt"', 'Any name ending in .txt.']] },
      check: (res, st) => {
        if (!ok(res)) return false;
        const got = lines(res.stdout);
        if (!got.length || !got.every(l => l.endsWith('.txt'))) return false;
        return setEq(got.map(lastSeg), allPathsWithExt(st.fs, '.txt').map(lastSeg));
      } },

    { id: 'find-prefix', title: 'Starts with q', setup: home,
      brief: 'Inside reports, find every file whose name starts with the letter q.',
      concept: 'find can start in any folder (not just .), and the wildcard can go at the end of the pattern.',
      skeleton: 'find <folder> -name "<letter>*"',
      solution: { cmd: 'find reports -name "q*"', parts: [['find reports', 'Searches only inside reports.'], ['-name "q*"', 'Names starting with q.']] },
      check: res => ok(res) && setEq(lines(res.stdout).map(lastSeg), ['q1.txt', 'q2.txt']) },

    { id: 'find-folder', title: 'Folders count too', setup: home,
      brief: 'There is a folder called archive somewhere. Find where it lives (this time it is not a file).',
      concept: 'find -name also finds folders, not just files.',
      skeleton: 'find <folder> -name <name>',
      solution: { cmd: 'find . -name archive', parts: [['find .', 'Searches from the current folder.'], ['-name archive', 'Anything called archive (file or folder).']] },
      check: res => ok(res) && res.stdout.includes('archive') },

    { id: 'find-csv', title: 'Every CSV', setup: home,
      brief: 'Find every .csv file on your disk: the data team wants to know which exports exist.',
      concept: 'Same wildcard trick, different extension.',
      skeleton: 'find <folder> -name "*.<extension>"',
      solution: { cmd: 'find . -name "*.csv"', parts: [['find .', 'From the current folder.'], ['-name "*.csv"', 'Everything ending in .csv.']] },
      check: (res, st) => {
        if (!ok(res)) return false;
        const got = lines(res.stdout);
        return got.length > 0 && got.every(l => l.endsWith('.csv')) && setEq(got.map(lastSeg), allPathsWithExt(st.fs, '.csv').map(lastSeg));
      } },

    { id: 'find-digit', title: 'Starts with 2', setup: home,
      brief: 'Find everything whose name starts with the number 2.',
      concept: 'The wildcard works the same with digits: the pattern is "2, then anything".',
      skeleton: 'find <folder> -name "<start>*"',
      solution: { cmd: 'find . -name "2*"', parts: [['find .', 'From the current folder.'], ['-name "2*"', 'Names starting with 2.']] },
      check: res => ok(res) && setEq(lines(res.stdout).map(lastSeg), ['2024_trip.jpg']) },

    { id: 'grep-csv', title: 'Not just .txt', setup: at('reports', 'archive'),
      brief: 'You\'re in reports/archive. grep works on any text file, not only .txt: search budget.csv for "amount".',
      concept: 'grep does not care about the extension: a .csv is plain text too.',
      skeleton: 'grep <word> <file>',
      solution: { cmd: 'grep amount budget.csv', parts: [['grep', 'Searches text.'], ['amount', 'The word.'], ['budget.csv', 'The file (a CSV is plain text).']] },
      check: res => ok(res) && res.stdout.includes('amount') },
  ];

  const L3 = [
    { id: 'pipe-filter', title: 'Filter the listing', setup: at('photos'),
      brief: 'You\'re in photos. List what is here, but only show entries with "2024" in the name.',
      concept: 'A pipe (|) sends the output of one command into the next one. Connect the listing to a text filter.',
      skeleton: '<command that lists> | <command that filters> <word>',
      solution: { cmd: 'ls | grep 2024', parts: [['ls', 'Lists the folder.'], ['|', 'Hands that list to the next command.'], ['grep 2024', 'Keeps only lines containing 2024.']] },
      check: res => ok(res) && res.stdout.trim() === '2024_trip.jpg' },

    { id: 'redir-save', title: 'Save the listing', setup: home,
      brief: 'Save the listing of your home folder into a new file called filelist.txt, instead of printing it on screen.',
      concept: '> redirects a command\'s output into a file: it creates the file, or replaces it if it exists.',
      skeleton: '<command> > <file>',
      solution: { cmd: 'ls > filelist.txt', parts: [['ls', 'Produces the listing.'], ['>', 'Writes it to a file instead of the screen.'], ['filelist.txt', 'The target file.']] },
      check: (res, st) => {
        const c = contentOf(st.fs, 'filelist.txt');
        return c !== null && setEq(lines(c), namesOf(getNode(st.fs, [])).filter(n => n !== 'filelist.txt'));
      } },

    { id: 'redir-append', title: 'Add to the log', setup: st => { home(st); if (!exists(st.fs, 'log.txt')) st.fs.children['log.txt'] = f('System boot at 08:00\n'); },
      brief: 'Add the line "Backup complete" to the END of log.txt without erasing what is already there.',
      concept: '>> appends to the end of the file; > would overwrite all of it. echo prints whatever text you give it.',
      skeleton: 'echo "<text>" __ <file>',
      solution: { cmd: 'echo "Backup complete" >> log.txt', parts: [['echo "Backup complete"', 'Produces the text.'], ['>>', 'Appends it, keeping what was there.'], ['log.txt', 'The file.']] },
      check: (res, st) => { const c = contentOf(st.fs, 'log.txt') || ''; return c.includes('System boot at 08:00') && c.includes('Backup complete'); },
      mistakes: [{ id: 'log-erased', label: 'Overwriting a file with >', test: (res, st) => !(contentOf(st.fs, 'log.txt') || '').includes('System boot'),
        tip: 'The log lost its first line: > replaced everything. Click "Restore files" and try the redirection that appends.' }] },

    { id: 'wc-file', title: 'Count the lines', setup: home,
      brief: 'How many lines does notes.txt have? Count them with a command, not by eye.',
      concept: 'wc ("word count") counts; with the -l option it counts lines.',
      skeleton: 'wc -_ <file>',
      solution: { cmd: 'wc -l notes.txt', parts: [['wc', 'Counts.'], ['-l', 'Lines only.'], ['notes.txt', 'The file.']] },
      check: res => ok(res) && wcCount(res.stdout) === 2 },

    { id: 'count-matches', title: 'Count the matches', setup: at('reports'),
      brief: 'In reports, count how many lines (across all the .txt files) mention "vendor", in any capitalization.',
      concept: 'Chain them: grep keeps the matching lines and, through a pipe, wc -l counts them.',
      skeleton: 'grep -_ <word> <files> | wc -_',
      solution: { cmd: 'grep -i vendor *.txt | wc -l', parts: [['grep -i vendor *.txt', 'Lines with "vendor", any capitalization.'], ['|', 'Hands those lines over…'], ['wc -l', '…to the line counter.']] },
      check: res => ok(res) && wcCount(res.stdout) === 2 },

    { id: 'count-files', title: 'Count files', setup: home,
      brief: 'Count how many .txt files exist on your whole disk, without listing them and counting by hand.',
      concept: 'find prints one line per file found, so counting those lines counts the files.',
      skeleton: 'find <folder> -name "<pattern>" | wc -_',
      solution: { cmd: 'find . -name "*.txt" | wc -l', parts: [['find . -name "*.txt"', 'One line per .txt file.'], ['| wc -l', 'Counts those lines.']] },
      check: (res, st) => ok(res) && wcCount(res.stdout) === allPathsWithExt(st.fs, '.txt').length },

    { id: 'count-recursive', title: 'Count across the disk', setup: home,
      brief: 'Count how many lines on your WHOLE disk mention "urgent", in any capitalization.',
      concept: 'Combine the recursive, case-insensitive search with the line counter.',
      skeleton: 'grep -__ <word> <folder> | wc -_',
      solution: { cmd: 'grep -ri urgent . | wc -l', parts: [['grep -ri urgent .', 'Every line with "urgent", in every folder.'], ['| wc -l', 'How many there are.']] },
      check: res => ok(res) && wcCount(res.stdout) === 2 },

    { id: 'ls-folders', title: 'Folders only', setup: home,
      brief: 'List only the folders in your home folder (not the files), using a pipe.',
      concept: 'ls marks folders with a trailing /. Filter on that character.',
      skeleton: 'ls | grep <character>',
      solution: { cmd: 'ls | grep /', parts: [['ls', 'Lists everything.'], ['| grep /', 'Keeps only entries with / (the folders).']] },
      check: (res, st) => ok(res) && setEq(lines(res.stdout), namesOf(getNode(st.fs, [])).filter(n => n.endsWith('/'))) },

    { id: 'save-count', title: 'Save the count', setup: home,
      brief: 'Save into a new file, txt_count.txt, how many .txt files there are on your disk (the number, not the list).',
      concept: 'A pipe and a redirection can go together: build the result first, then save it with > at the end.',
      skeleton: 'find <folder> -name "<pattern>" | wc -_ > <file>',
      solution: { cmd: 'find . -name "*.txt" | wc -l > txt_count.txt', parts: [['find . -name "*.txt" | wc -l', 'Works out how many .txt files exist.'], ['> txt_count.txt', 'Saves the number in the file.']] },
      check: (res, st) => {
        const c = contentOf(st.fs, 'txt_count.txt');
        return c !== null && wcCount(c) === allPathsWithExt(st.fs, '.txt').filter(p => lastSeg(p) !== 'txt_count.txt').length;
      } },

    { id: 'wc-readme', title: 'How long is the readme?', setup: home,
      brief: 'Count how many lines readme.txt has.',
      concept: 'The same line counter as before, on another file.',
      skeleton: 'wc -_ <file>',
      solution: { cmd: 'wc -l readme.txt', parts: [['wc -l', 'Counts lines.'], ['readme.txt', 'The file.']] },
      check: res => ok(res) && wcCount(res.stdout) === 2 },

    { id: 'count-finale', title: 'Level finale', setup: home,
      brief: 'Last one in this level: across your WHOLE disk, count how many lines mention "vendor", in any capitalization.',
      concept: 'Recursive search + ignore case + pipe into the counter.',
      skeleton: 'grep -__ <word> <folder> | wc -_',
      solution: { cmd: 'grep -ri vendor . | wc -l', parts: [['grep -ri vendor .', 'Every line with "vendor", in every folder.'], ['| wc -l', 'Counts them.']] },
      check: res => ok(res) && wcCount(res.stdout) === 2 },
  ];

  const L4 = [
    { id: 'chmod-x', title: 'Ask for permission', setup: home,
      brief: 'To run run.sh directly, give it execute permission.',
      concept: 'chmod changes permissions; +x adds the execute permission.',
      skeleton: 'chmod +_ <file>',
      solution: { cmd: 'chmod +x run.sh', parts: [['chmod', 'Changes permissions.'], ['+x', 'Adds execute permission.'], ['run.sh', 'The file.']] },
      check: (res, st) => execFlag(st.fs, 'run.sh') },

    { id: 'chmod-num', title: 'The numeric way', setup: home,
      brief: 'Another script, cleanup.sh, must be executable too. This time use numeric mode instead of +x.',
      concept: 'Each digit is the permissions of owner, group and everyone else: read=4, write=2, execute=1, added up. 7 = everything; 5 = read + execute.',
      skeleton: 'chmod _55 <file>',
      solution: { cmd: 'chmod 755 cleanup.sh', parts: [['chmod', 'Changes permissions.'], ['755', 'You: 7 (all). Group and others: 5 (read and execute).'], ['cleanup.sh', 'The file.']] },
      check: (res, st) => execFlag(st.fs, 'cleanup.sh') },

    { id: 'env-name', title: 'Introduce yourself', setup: home,
      brief: 'Store your name in an environment variable called NAME, then print it using that variable.',
      concept: 'export NAME=value creates the variable (no spaces around =). To use its value, put $ in front. Those are two commands: separate them with ; or run them one at a time.',
      skeleton: 'export NAME=<your name>   then   echo $____',
      solution: { cmd: 'export NAME=Fran; echo $NAME', parts: [['export NAME=Fran', 'Creates NAME with the value Fran.'], [';', 'Separates two commands on one line.'], ['echo $NAME', 'Prints the value of the variable.']] },
      check: (res, st) => !!st.env.NAME && res.stdout.includes(st.env.NAME),
      partial: (res, st) => (!res.error && st.env.NAME) ? 'Good: NAME is now "' + st.env.NAME + '". Now print its value.' : null },

    { id: 'env-two', title: 'Two variables', setup: home,
      brief: 'Store your name in NAME and your role in ROLE (for example "intern"), and print both on one line, like "Fran is an intern".',
      concept: 'Inside double quotes, variables are replaced by their values: you can mix text and variables in one echo.',
      skeleton: 'export ROLE=<role>   then   echo "$____ is an $____"',
      solution: { cmd: 'export NAME=Fran; export ROLE=intern; echo "$NAME is an $ROLE"', parts: [['export NAME=Fran', 'First variable.'], ['export ROLE=intern', 'Second variable.'], ['echo "$NAME is an $ROLE"', 'Text with both variables inside.']] },
      check: (res, st) => !!st.env.NAME && !!st.env.ROLE && res.stdout.includes(st.env.NAME) && res.stdout.includes(st.env.ROLE),
      partial: (res, st) => {
        if (res.error || !st.env.NAME) return null;
        if (!st.env.ROLE) return 'Good, NAME exists. You still need to create ROLE.';
        return 'Both variables exist. Now print them together on one line.';
      } },

    { id: 'env-save', title: 'Save your intro', setup: home,
      brief: 'Write your name into a new file, whoami.txt, using the NAME variable (don\'t type your name by hand).',
      concept: 'Combine echo with the variable and a > redirection into the file.',
      skeleton: 'echo "$____" > <file>',
      solution: { cmd: 'echo "$NAME" > whoami.txt', parts: [['echo "$NAME"', 'Produces the value of NAME.'], ['> whoami.txt', 'Saves it into the file.']] },
      check: (res, st) => { const c = contentOf(st.fs, 'whoami.txt'); return !!st.env.NAME && c !== null && c.trim() === st.env.NAME; } },

    { id: 'cat-script', title: 'Look before you run', setup: home,
      brief: 'Before running a script, take a look. Print run.sh and notice its first line (the "shebang") and what it does.',
      concept: 'The first line #!/bin/bash tells the system which program interprets the script. To look at a file: the usual command.',
      skeleton: 'cat <script>',
      solution: { cmd: 'cat run.sh', parts: [['cat run.sh', 'Prints the script. Its first line, #!/bin/bash, is the shebang.']] },
      check: res => ok(res) && res.stdout.includes('#!/bin/bash') && res.stdout.includes('Deploy complete') },

    { id: 'run-script', title: 'Run it', setup: home,
      brief: 'Now that run.sh is executable, run it.',
      concept: 'Bash does not look for programs in the current folder on its own: give it the path, starting with ./ ("here").',
      skeleton: './<script>',
      solution: { cmd: './run.sh', parts: [['./', 'In this folder…'], ['run.sh', '…run this script.']] },
      check: res => ok(res) && res.stdout.trim() === 'Deploy complete.' },

    { id: 'date-echo', title: 'Ask bash for the date', setup: home,
      brief: "Use command substitution to print today's date: run a command inside $( ) and let bash insert its output.",
      concept: '$(command) runs the command and puts its output right there. date +%F gives the date as YYYY-MM-DD.',
      skeleton: 'echo $(<date command>)',
      solution: { cmd: 'echo $(date +%F)', parts: [['date +%F', "Today's date, YYYY-MM-DD."], ['$( )', 'Inserts that output into the command.'], ['echo', 'Prints it.']] },
      check: res => ok(res) && res.stdout.trim() === FAKE_DATE },

    { id: 'date-touch', title: 'A dated file', setup: home,
      brief: "Create an empty file named notes_<today's date>.txt, letting the date write itself.",
      concept: 'Substitution with $( ) works in the middle of a file name.',
      skeleton: 'touch notes_$(_____).txt',
      solution: { cmd: 'touch notes_$(date +%F).txt', parts: [['touch', 'Creates the file.'], ['notes_$(date +%F).txt', 'The name, with the date inserted automatically.']] },
      check: (res, st) => { const n = exists(st.fs, 'notes_' + FAKE_DATE + '.txt'); return !!n && n.type === 'file'; } },

    { id: 'date-mv', title: 'Rename with a date', setup: home,
      brief: "Rename notes.txt to notes_<today's date>_final.txt, again with the automatic date.",
      concept: 'Same as before, with the renaming command.',
      skeleton: 'mv notes.txt notes_$(_____)_final.txt',
      solution: { cmd: 'mv notes.txt notes_$(date +%F)_final.txt', parts: [['mv notes.txt', 'Renames notes.txt…'], ['notes_$(date +%F)_final.txt', "…to a name with today's date."]] },
      check: (res, st) => !exists(st.fs, 'notes.txt') && !!exists(st.fs, 'notes_' + FAKE_DATE + '_final.txt') },

    { id: 'nested-sub', title: 'Combine and count', setup: home,
      brief: 'Print one line saying "Lines: N", where N is the number of lines in notes_backup.txt, using command substitution.',
      concept: 'Pipes work inside $( ) too. Wrap the whole text in double quotes.',
      skeleton: 'echo "Lines: $(<command> | wc -_)"',
      solution: { cmd: 'echo "Lines: $(cat notes_backup.txt | wc -l)"', parts: [['cat notes_backup.txt | wc -l', 'Counts the lines of the backup.'], ['$( )', 'Inserts that number…'], ['echo "Lines: …"', '…into the text.']] },
      check: res => ok(res) && res.stdout.trim() === 'Lines: 2' },

    { id: 'date-cp', title: 'Dated report backup', setup: home,
      brief: "From your home folder, copy reports/q1.txt to reports/q1_<today's date>.txt.",
      concept: 'cp + a relative path + the date inserted with $( ).',
      skeleton: 'cp reports/q1.txt reports/q1_$(_____).txt',
      solution: { cmd: 'cp reports/q1.txt reports/q1_$(date +%F).txt', parts: [['cp reports/q1.txt', 'Copies the report…'], ['reports/q1_$(date +%F).txt', '…to a dated name in the same folder.']] },
      check: (res, st) => { const o = contentOf(st.fs, 'reports/q1.txt'); return o !== null && o === contentOf(st.fs, 'reports/q1_' + FAKE_DATE + '.txt'); } },

    { id: 'chmod-run', title: 'Permission and run', setup: home,
      brief: 'There is still setup.sh, which nobody touched. Give it execute permission AND run it; you can do both on one line.',
      concept: 'Two commands you already know, chained with ; (or one at a time).',
      skeleton: 'chmod +_ <script>; ./<script>',
      solution: { cmd: 'chmod +x setup.sh; ./setup.sh', parts: [['chmod +x setup.sh', 'Gives it execute permission.'], [';', 'And then…'], ['./setup.sh', '…runs it.']] },
      check: res => ok(res) && res.stdout.trim() === 'Setup done.',
      partial: (res, st) => (!res.error && execFlag(st.fs, 'setup.sh')) ? 'Good, setup.sh is executable now. It still has to be run.' : null },

    { id: 'date-log', title: 'Dated log entry', setup: home,
      brief: "Append the line \"Backup on <today's date>\" to log.txt, with the automatic date and without erasing what's there.",
      concept: 'echo with text + $( ) inside the quotes, and the redirection that appends.',
      skeleton: 'echo "Backup on $(_____)" __ <file>',
      solution: { cmd: 'echo "Backup on $(date +%F)" >> log.txt', parts: [['echo "Backup on $(date +%F)"', "The text with today's date."], ['>> log.txt', 'Appended to the end of the log.']] },
      check: (res, st) => { const c = contentOf(st.fs, 'log.txt') || ''; return c.includes('System boot at 08:00') && c.includes('Backup on ' + FAKE_DATE); } },
  ];

  const AUG = 'logs/import_2026-08-14.log';
  const CSV = 'exports/payments.csv';
  const DUPS = 'grep -r duplicate_batch logs | cut -d= -f2 | sort | uniq -c';
  const L5 = [
    { id: 'log-count', title: 'How many errors?', setup: home,
      brief: 'Support: "A client says we paid them twice in August. Let\'s start with the August 14 log (' + AUG + '): how many ERROR lines does it have?"',
      concept: 'grep has a -c option ("count"): instead of printing the lines, it says how many match.',
      skeleton: 'grep -_ ERROR <log file>',
      solution: { cmd: 'grep -c ERROR ' + AUG, parts: [['grep', 'Searches text.'], ['-c', 'Prints only how many lines match.'], ['ERROR', 'The word (uppercase, as in the log).'], [AUG, "That day's log."]] },
      check: (res, st) => ok(res) && lines(res.stdout).length === 1 && wcCount(res.stdout) === wcCount(expected(st, 'grep -c ERROR ' + AUG)) },

    { id: 'log-lines', title: 'With line numbers', setup: home,
      brief: 'Support: "Show me those ERROR lines with their line numbers, so I can find them in the log."',
      concept: 'The -n option puts the line number in front of every match.',
      skeleton: 'grep -_ ERROR <log file>',
      solution: { cmd: 'grep -n ERROR ' + AUG, parts: [['grep -n', 'Searches and prefixes the line number.'], ['ERROR', 'The word.'], [AUG, 'The log.']] },
      check: (res, st) => ok(res) && sameLines(stripLabels(res.stdout), stripLabels(expected(st, 'grep -n ERROR ' + AUG))) },

    { id: 'log-all', title: 'Which other logs?', setup: home,
      brief: 'Support: "There is a duplicate_batch error. Does it show up in other logs? Search the whole logs folder."',
      concept: 'Recursive search over a folder: grep prints which file each line came from.',
      skeleton: 'grep -_ <word> <folder>',
      solution: { cmd: 'grep -r duplicate_batch logs', parts: [['grep -r', 'Searches every file in the folder.'], ['duplicate_batch', 'The error type.'], ['logs', 'The logs folder.']] },
      check: (res, st) => ok(res) && sameLines(stripLabels(res.stdout), stripLabels(expected(st, 'grep -r duplicate_batch logs'))) },

    { id: 'csv-head', title: 'The first lines', setup: home,
      brief: 'Data team: "Before analysing the export, see what it looks like: show me only the first 5 lines of ' + CSV + '."',
      concept: 'head shows the start of a file; -n N chooses how many lines.',
      skeleton: 'head -n _ <file>',
      solution: { cmd: 'head -n 5 ' + CSV, parts: [['head', 'Shows the start.'], ['-n 5', 'The first 5 lines (the first one is the header).'], [CSV, 'The payments export.']] },
      check: (res, st) => ok(res) && sameOrdered(res.stdout, expected(st, 'head -n 5 ' + CSV)) },

    { id: 'csv-tail', title: 'The last lines', setup: home,
      brief: 'Data team: "Now the last 3, in case something odd is at the end."',
      concept: 'tail is the opposite of head: it shows the end of the file.',
      skeleton: 'tail -n _ <file>',
      solution: { cmd: 'tail -n 3 ' + CSV, parts: [['tail', 'Shows the end.'], ['-n 3', 'The last 3 lines.'], [CSV, 'The export.']] },
      check: (res, st) => ok(res) && sameOrdered(res.stdout, expected(st, 'tail -n 3 ' + CSV)),
      note: 'Did you spot the payment with no amount and the one with no date? Those are NULLs: SQL will teach you to find them.' },

    { id: 'csv-cut', title: 'Just one column', setup: home,
      brief: 'Data team: "I only need the artist column of ' + CSV + '. It is the 2nd column and columns are separated by commas."',
      concept: 'cut slices columns: -d sets the separator and -f which column (field) you want.',
      skeleton: 'cut -d_ -f_ <file>',
      solution: { cmd: 'cut -d, -f2 ' + CSV, parts: [['cut', 'Slices columns.'], ['-d,', 'The separator is a comma.'], ['-f2', 'Keep column 2.'], [CSV, 'The file.']] },
      check: (res, st) => ok(res) && sameOrdered(res.stdout, expected(st, 'cut -d, -f2 ' + CSV)) },

    { id: 'csv-uniq', title: 'Payments per artist', setup: home,
      brief: 'Data team: "How many payments does each artist have? Count how many times each value of that column appears."',
      concept: 'uniq -c counts repeated lines, but only when they are next to each other: that is why you sort first.',
      skeleton: 'cut -d, -f2 <file> | ____ | uniq -_',
      solution: { cmd: 'cut -d, -f2 ' + CSV + ' | sort | uniq -c', parts: [['cut -d, -f2 ' + CSV, 'The artist column.'], ['| sort', 'Sorts it: equal values end up together.'], ['| uniq -c', 'Counts each group of equal values.']] },
      check: (res, st) => ok(res) && sameLines(res.stdout, expected(st, 'cut -d, -f2 ' + CSV + ' | sort | uniq -c')),
      note: 'Look at "luna ferreyra" and "LOS CARDALES": the same artist written differently counts separately. That is a data-quality problem you will clean up in SQL with TRIM and LOWER.' },

    { id: 'dup-names', title: 'The guilty file', setup: home,
      brief: 'Support: "Show me which file raised duplicate_batch and how many times." Take the file name out of those lines (it comes after the =) and count it.',
      concept: 'Chain them: grep finds the lines, cut -d= -f2 keeps what comes after the =, and sort | uniq -c counts.',
      skeleton: 'grep -r <word> <folder> | cut -d_ -f_ | sort | uniq -_',
      solution: { cmd: DUPS, parts: [['grep -r duplicate_batch logs', 'The error lines, in every log.'], ['| cut -d= -f2', 'What comes after the =: the file name.'], ['| sort | uniq -c', 'How many times each file appears.']] },
      check: (res, st) => ok(res) && sameLines(res.stdout, expected(st, DUPS)) },

    { id: 'dup-distinct', title: 'How many different files?', setup: home,
      brief: 'Support: "How many different files were imported twice? I need a single number."',
      concept: 'uniq without -c keeps one copy of each value; counting those lines tells you how many distinct values there are.',
      skeleton: 'grep -r <word> <folder> | cut -d= -f2 | sort | ____ | wc -_',
      solution: { cmd: 'grep -r duplicate_batch logs | cut -d= -f2 | sort | uniq | wc -l', parts: [['grep … | cut -d= -f2', 'The file names.'], ['| sort | uniq', 'One of each.'], ['| wc -l', 'How many.']] },
      check: (res, st) => ok(res) && lines(res.stdout).length === 1 && wcCount(res.stdout) === wcCount(expected(st, 'grep -r duplicate_batch logs | cut -d= -f2 | sort | uniq | wc -l')) },

    { id: 'dup-save', title: 'Attach it to the ticket', setup: home,
      brief: 'Support: "Perfect. Save that result (file and number of times) into reports/duplicates.txt so I can attach it to the ticket."',
      concept: 'The same pipe as before, with a > redirection into the file at the end.',
      skeleton: '<the guilty-file pipe> > <folder>/<file>',
      solution: { cmd: DUPS + ' > reports/duplicates.txt', parts: [[DUPS, 'The result from before.'], ['> reports/duplicates.txt', 'Saved into the report file.']] },
      check: (res, st) => { const c = contentOf(st.fs, 'reports/duplicates.txt'); return c !== null && sameLines(c, expected(st, DUPS)); } },

    { id: 'dup-append', title: 'Sign the report', setup: home,
      brief: 'Support: "Add a last line "Reviewed on <today\'s date>", with the automatic date."',
      concept: 'echo with $( ) inside, and the redirection that appends (not the one that overwrites).',
      skeleton: 'echo "Reviewed on $(_____)" __ <file>',
      solution: { cmd: 'echo "Reviewed on $(date +%F)" >> reports/duplicates.txt', parts: [['echo "Reviewed on $(date +%F)"', 'The text with the date.'], ['>> reports/duplicates.txt', 'Appended to the report.']] },
      check: (res, st) => { const c = contentOf(st.fs, 'reports/duplicates.txt') || ''; return c.includes('payments_2026-08.csv') && c.includes('Reviewed on ' + FAKE_DATE); } },

    { id: 'script-run', title: "The team's script", setup: home,
      brief: 'The team left scripts/check_logs.sh, which counts the errors in each log. Give it execute permission and run it from your home folder.',
      concept: 'Permission with chmod, and running it with the path to the script (it starts with ./ because it is below the current folder).',
      skeleton: 'chmod +_ <script path>; ./<script path>',
      solution: { cmd: 'chmod +x scripts/check_logs.sh; ./scripts/check_logs.sh', parts: [['chmod +x scripts/check_logs.sh', 'Gives it execute permission.'], ['./scripts/check_logs.sh', 'Runs it by its path.']] },
      check: res => ok(res) && res.stdout.includes('Error count per log') && res.stdout.includes('import_2026-08-14.log:3'),
      partial: (res, st) => (!res.error && execFlag(st.fs, 'scripts/check_logs.sh')) ? 'Good, the script is executable now. It still has to be run.' : null,
      note: 'Case solved on the logs side: payments_2026-08.csv was imported twice on August 14. In SQL you will measure how much was overpaid.' },
  ];

  const LEVELS = [
    { id: 'files', title: 'Navigation and files', minutes: 12,
      intro: 'First day at Sonora Royalties. Your computer is a terminal: learn to move around and handle files.',
      cheat: [['pwd', 'Which folder you are in'], ['ls [folder]', 'Lists contents'], ['cd <folder>', 'Goes into a folder'], ['cd ..', 'Goes up one level'], ['cd', 'Back to your home folder'],
        ['mkdir <name>', 'Creates a folder'], ['touch <file>', 'Creates an empty file'], ['cp <source> <dest>', 'Copies'], ['mv <source> <dest>', 'Moves or renames'],
        ['rm <file>', 'Deletes (no trash bin)'], ['cat <file>', 'Prints the contents'], ['less <file>', 'Shows it page by page']],
      missions: L1 },
    { id: 'search', title: 'Searching', minutes: 10,
      intro: 'One fact among hundreds of files: grep searches text inside them, find searches files by name.',
      cheat: [['grep <word> <files>', 'Searches text inside files'], ['grep -i', 'Ignores upper/lower case'], ['grep -r <word> <folder>', 'Searches subfolders too'],
        ['find <folder> -name "<pattern>"', 'Searches by name'], ['*', 'Wildcard: anything ("*.txt")']],
      missions: L2 },
    { id: 'pipes', title: 'Pipes and redirection', minutes: 12,
      intro: 'Chain commands and save results into files: the base of every automation.',
      cheat: [['a | b', "a's output goes into b"], ['> file', 'Saves the output (replaces)'], ['>> file', 'Appends to the end'], ['wc -l', 'Counts lines']],
      missions: L3 },
    { id: 'scripts', title: 'Permissions, variables and scripts', minutes: 14,
      intro: 'Make scripts executable, use variables, and let bash write the date for you.',
      cheat: [['chmod +x <file>', 'Lets you run it'], ['chmod 755 <file>', 'Same thing, numeric mode'], ['export VAR=value', 'Creates a variable'], ['echo $VAR', 'Prints its value'],
        ['./script.sh', 'Runs a script'], ['#!/bin/bash', "Shebang: a script's first line"], ['$(command)', "Inserts a command's output"], ['date +%F', 'Date as YYYY-MM-DD'], ['a; b', 'Runs a, then b']],
      missions: L4 },
    { id: 'logs', title: 'Real case: import logs', minutes: 15,
      intro: 'Support says: "A client claims we paid them twice in August." Dig into the logs and the exports.',
      cheat: [['grep -c', 'How many lines match'], ['grep -n', 'With line numbers'], ['head -n N', 'First N lines'], ['tail -n N', 'Last N lines'],
        ['cut -d, -f2', 'Column 2, comma-separated'], ['sort', 'Sorts lines'], ['uniq', 'Drops repeated neighbours'], ['uniq -c', 'Counts them'], ['… | sort | uniq -c', 'How many times each value appears']],
      missions: L5 },
  ];

  const flat = [];
  LEVELS.forEach((lv, li) => lv.missions.forEach((m, mi) => flat.push({ mission: m, li, mi, gi: flat.length })));

  // Disk as it would be right before mission gi, replaying every earlier solution.
  function buildWorldAt(gi) {
    const st = S.freshState();
    for (let i = 0; i < gi; i++) {
      const m = flat[i].mission;
      if (m.setup) m.setup(st);
      S.runLine(m.solution.cmd, st);
    }
    return st;
  }

  /* ---- hint 1: which part is off (never names the answer) ---- */
  function optsOf(args) {
    const s = new Set();
    for (let i = 0; i < args.length; i++) {
      const x = args[i];
      if (x === '-name') { s.add('name'); i++; continue; }
      if (/^-\d+$/.test(x)) { s.add('n'); continue; }
      const m = x.match(/^-([a-zA-Z]+)/);
      if (m) for (const ch of (/^-[df]/.test(x) ? x[1] : m[1])) s.add(ch);
    }
    return s;
  }
  // Arguments plus option values (-f2, -n 5), without bare flags like -ri.
  function positional(args) {
    const out = [];
    for (let i = 0; i < args.length; i++) {
      const x = args[i];
      if (x === '-d' || x === '-f' || x === '-n' || x === '-name') { out.push(x + (args[i + 1] || '')); i++; continue; }
      if (!/^-[a-zA-Z]+$/.test(x)) out.push(x);
    }
    return out;
  }
  const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function diagnose(m, input, res) {
    let user;
    try { user = S.parseInput(input); } catch (e) { return 'There is an unclosed quote: every " or \' needs its partner.'; }
    const sol = S.parseInput(m.solution.cmd);
    const err = (res && res.error) || '';
    const first = (user[0] && user[0].stages[0] && user[0].stages[0][0]) || '';
    if (/command not found/.test(err)) {
      return /\.sh$/.test(first)
        ? "Bash can't find that script: to run a program from a folder you have to tell bash where it is."
        : "Bash doesn't recognise a command on your line: check how it is spelled.";
    }
    if (/Permission denied/.test(err)) return 'The script exists, but it does not have execute permission yet.';
    if (/syntax error/.test(err)) return 'There is a syntax error: check your quotes and symbols like >, >> or |.';
    if (user.length < sol.length) return 'This task takes ' + sol.length + ' commands and you wrote ' + user.length + '. Chain them with ; or run them one at a time.';
    for (let k = 0; k < Math.min(user.length, sol.length); k++) {
      const u = user[k], s = sol[k];
      if (u.stages.length !== s.stages.length) {
        return s.stages.length > u.stages.length
          ? 'Something is missing in the chain: the task needs ' + s.stages.length + ' commands joined by | and your line has ' + u.stages.length + '.'
          : 'Your line has more commands joined by | than needed.';
      }
      for (let i = 0; i < s.stages.length; i++) {
        const uv = u.stages[i][0], sv = s.stages[i][0];
        const where = s.stages.length > 1 ? 'in the ' + ordinal(i + 1) + ' part of the pipe, ' : '';
        if (uv !== sv) return cap(where + '"' + uv + '" is not the command this needs.');
        const uo = optsOf(u.stages[i].slice(1)), so = optsOf(s.stages[i].slice(1));
        const missing = [...so].filter(x => !uo.has(x)), extra = [...uo].filter(x => !so.has(x));
        if (missing.length) return cap(where + 'the "' + uv + '" command is right, but it is missing ' + (missing.length > 1 ? 'more than one option (flag).' : 'an option (flag).'));
        if (extra.length) return cap(where + 'the "' + uv + '" command is right, but it has an option that does not belong here.');
      }
      if (s.redir && !u.redir) return 'The result has to end up saved in a file, not just on screen.';
      if (!s.redir && u.redir) return 'This task wants the result on screen: no need to save it into a file.';
      if (s.redir && u.redir && s.redir.append !== u.redir.append) {
        return s.redir.append ? 'Careful with the redirection: the one you used replaces the whole file.' : 'Careful with the redirection: the one you used appends, and this task wants the file created with the result.';
      }
    }
    if (/No such file or directory/.test(err)) return "A file or folder name doesn't exist from where you are. Check the exact name (case, extension) and your location with pwd or ls.";
    if (/Is a directory/.test(err)) return 'You gave a folder to a command that expected a file.';
    if (err) return 'The command returned an error: read it calmly, it usually says what is missing.';
    const argsDiffer = user.some((u, k) => sol[k] && u.stages.some((stg, i) => sol[k].stages[i] && positional(stg.slice(1)).join(' ') !== positional(sol[k].stages[i].slice(1)).join(' ')));
    if (argsDiffer) return 'Command and options look right: check the arguments (file or folder name, numbers, or the word to search).';
    return 'Your command looks a lot like a typical solution, but the result is not the one asked for. Check which folder you run it from (pwd) and reread the task.';
  }

  /* ---- typical mistakes: recorded for the weak-spots list, one tip shown per attempt ---- */
  function grepOpts(stmts) {
    for (const s of stmts) for (const stg of s.stages) if (stg[0] === 'grep') return optsOf(stg.slice(1));
    return null;
  }
  const DETECTORS = [
    { id: 'redir-overwrite', label: 'Using > when you needed >> to append',
      tip: 'Careful: > replaces the whole content of the file. To add lines at the end there is another redirection.',
      test: c => c.sr && c.sr.append && c.ur && !c.ur.append },
    { id: 'no-dot-slash', label: 'Running a script without its path (./)',
      tip: 'Bash does not look for programs in the current folder: tell it where the script is.',
      test: c => /command not found/.test(c.err) && /\.sh$/.test(c.first) },
    { id: 'no-exec-permission', label: 'Running a script without execute permission',
      tip: '"Permission denied" means the file lacks execute permission.',
      test: c => /Permission denied/.test(c.err) },
    { id: 'grep-on-folder', label: 'Using grep on a folder without walking it',
      tip: 'grep only reads files: to go into folders and subfolders it needs an extra option.',
      test: c => /^grep: .*Is a directory/.test(c.err) },
    { id: 'case-sensitive', label: 'Forgetting that grep is case-sensitive',
      tip: 'grep tells upper and lower case apart: for it, "vendor" and "Vendor" are different words.',
      test: c => c.so && c.uo && c.so.has('i') && !c.uo.has('i') },
    { id: 'missing-recursive', label: 'Searching without walking subfolders',
      tip: 'If what you are looking for may be in a subfolder, grep has to walk into them.',
      test: c => c.so && c.uo && c.so.has('r') && !c.uo.has('r') && !/Is a directory/.test(c.err) },
    { id: 'pipe-to-file', label: 'Using | to save into a file',
      tip: '| connects to another command. To save output into a file you use a redirection.',
      test: c => c.sr && !c.ur && c.stages > 1 && /command not found/.test(c.err) },
    { id: 'command-typo', label: 'Misspelled command',
      tip: 'Bash is literal: a misspelled command answers "command not found".',
      test: c => /command not found/.test(c.err) && !/\.sh$/.test(c.first) && !(c.sr && c.stages > 1) },
    { id: 'path-not-found', label: 'Wrong path or file name',
      tip: "If you're not sure of the name, check it with ls: names are case-sensitive and include the extension.",
      test: c => /No such file or directory/.test(c.err) },
  ];
  function detectMistakes(m, input, res, st) {
    let user;
    try { user = S.parseInput(input); } catch (e) { return []; }
    const sol = S.parseInput(m.solution.cmd);
    const lastRedir = stmts => (stmts.length ? stmts[stmts.length - 1].redir : null);
    const c = {
      err: (res && res.error) || '', first: (user[0] && user[0].stages[0] && user[0].stages[0][0]) || '',
      sr: lastRedir(sol), ur: lastRedir(user), so: grepOpts(sol), uo: grepOpts(user),
      stages: user[0] ? user[0].stages.length : 0,
    };
    const found = (m.mistakes || []).filter(x => { try { return x.test(res, st, input); } catch (e) { return false; } });
    return found.concat(DETECTORS.filter(d => d.test(c)));
  }

  function cheatUpTo(li) {
    return LEVELS.slice(0, li + 1).map(lv => ({ title: lv.title, rows: lv.cheat }));
  }

  OT.tracks = OT.tracks || {};
  OT.tracks.bash = {
    id: 'bash', title: 'Bash', levels: LEVELS, flat,
    buildWorldAt, diagnose, detectMistakes, cheatUpTo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
