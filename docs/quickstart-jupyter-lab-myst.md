---
title: Working with MyST in Jupyter Lab
subtitle: MyST has full support in Jupyter
subject: MyST Quickstart Tutorial
short_title: MyST in Jupyter
description: MyST Markdown can be used in JupyterLab with support for all MyST syntax as well as inline execution.
binder: https://mybinder.org/v2/gh/executablebooks/jupyterlab-myst/main?urlpath=lab
---

::::{important}
**Objective**

The goal of this quickstart is to get you up and running in [JupyterLab](https://jupyter.org), explore inline execution 📈, and working together with other MyST tools.

For this tutorial we are assuming some familiarity with [JupyterLab](https://jupyter.org), and MyST syntax (see the [MyST quickstart guide](./quickstart-myst-markdown.md)). We will be executing a few Python code cells in the notebook, familiarity with `numpy` and `matplotlib` is helpful but not necessary.
::::

![](#lookout-for-tutorial-actions)

:::{tip} 🛠 Install JupyterLab Locally
:class: dropdown
For this tutorial you must have installed JupyterLab locally (use a version greater than 3.0).

🛠 Install JupyterLab, following the guide at <https://jupyter.org/install>

To follow along on _without_ installing anything, you can try to [![Launch on Binder][binder-badge]][binder-link], however the install process may take up to ten minutes.
:::

## Install JupyterLab MyST

🛠 Install the JupyterLab MyST extension version: [![PyPI](https://img.shields.io/pypi/v/jupyterlab-myst.svg)](https://pypi.org/project/jupyterlab-myst)

```bash
pip install jupyterlab_myst
```

See the GitHub repository, [jupyterlab-myst](https://github.com/executablebooks/jupyterlab-myst) for full installation instructions.

:::{tip} 🛠 Verify the installation
:class: dropdown
To verify that the extension is registered with Jupyter, use:

```bash
jupyter labextension list
```

You should see the following text in the output:

```text
jupyterlab-myst v1.x.x enabled OK
```

:::

## Download quickstart content

We are going to download an example project that includes notebooks for use in JupyterLab with the MyST extension installed.
Our goal will be to try out some of the main features of `jupyterlab-myst`, including frontmatter, MyST syntax, and inline execution.

🛠 Download the example content, and navigate into the folder:

```bash
git clone https://github.com/executablebooks/jupyterlab-myst-quickstart.git
cd jupyterlab-myst-quickstart
```

### Explore the Notebooks

🛠 Launch JupyterLab with `jupyterlab-myst` activated [![Launch on Binder][binder-badge]][binder-link]

```bash
jupyter lab
```

:::{figure} ./images/jupyterlab-myst.png
:width: 100%
:name: jupyterlab-myst

MyST in JupyterLab, showing frontmatter and admonitions that are natively rendered! 🎉
:::

---

More Coming Soon™

- showing frontmatter
- advanced user interface elements like tabs, grids, and cards
- citations
- inline computation & variables examples <-- this is _really_ cool

---

## Conclusion 🥳

For now, that's it for this quickstart tutorial, please see the content in the notebooks or help contribute to the docs to help document these features! Other tutorials to explore are:

:::{card} MyST Documents 📑
:link: ./quickstart-myst-documents.md
Learn the basics of MyST Markdown, and export to a Word document, PDF, and $\LaTeX$!
:::

:::{card} MyST Markdown Guide 📖
:link: ./quickstart-myst-markdown.md
See an overview of MyST Markdown syntax with inline demos and examples.
:::

[binder-badge]: https://mybinder.org/badge_logo.svg
[binder-link]: https://mybinder.org/v2/gh/executablebooks/jupyterlab-myst-quickstart/main?urlpath=lab